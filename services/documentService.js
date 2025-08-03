/**
 * Document Service
 * Handles fetching and processing Google Docs associated with calendar events
 */

const { google } = require('googleapis');

// Cache for document content to improve performance
const documentCache = new Map();

/**
 * Clear document cache for a specific meeting
 * @param {string} meetingId - Meeting ID to clear cache for
 */
function clearDocumentCache(meetingId) {
  console.log(`[DocumentService] Clearing document cache for meeting: ${meetingId}`);
  
  // Since we don't have a direct mapping of meetingId to documentIds in the cache,
  // we'll need to clear the entire document cache
  // In a production environment, you might want to implement a more targeted approach
  documentCache.clear();
  
  console.log(`[DocumentService] Document cache cleared`);
}

/**
 * Create a Google Docs client
 * @param {Object} tokens - OAuth tokens
 * @returns {Object} - Google Docs client
 */
function createDocsClient(tokens) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/auth/google/callback'
  );
  
  oauth2Client.setCredentials({
    access_token: tokens.accessToken || tokens.access_token,
    refresh_token: tokens.refreshToken || tokens.refresh_token
  });
  
  return google.docs({ version: 'v1', auth: oauth2Client });
}

/**
 * Extract document ID from a Google Doc URL
 * @param {string} url - Google Doc URL
 * @returns {string|null} - Document ID or null if not found
 */
function extractDocumentIdFromUrl(url) {
  if (!url) return null;
  
  // Extract document ID from the URL
  const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return docIdMatch && docIdMatch[1] ? docIdMatch[1] : null;
}

/**
 * Get documents associated with an event
 * @param {Object} event - Calendar event object
 * @param {Object} tokens - OAuth tokens
 * @returns {Promise<Array>} - Array of document objects
 */
async function getDocumentsForEvent(event, tokens) {
  console.log(`[DocumentService] Getting documents for event: ${event.id}`);
  console.log(`[DocumentService] Event:`, event);
  if (!event) return [];
  
  const docs = [];
  
  // Check for attachments
  if (event.attachments && Array.isArray(event.attachments)) {
    event.attachments.forEach(attachment => {
      // Look for Google Doc attachments
      if (attachment.mimeType === 'application/vnd.google-apps.document' && attachment.fileUrl) {
        const docId = extractDocumentIdFromUrl(attachment.fileUrl);
        if (docId) {
          docs.push({
            id: docId,
            title: attachment.title || 'Untitled Document',
            url: attachment.fileUrl
          });
        }
      }
    });
  }
  
  // Only return documents that are actually attached to this specific event
  if (docs.length === 0) {
    console.log(`[DocumentService] No attachments found for event: ${event.id}`);
  }
  
  return docs;
}

/**
 * Get document content by ID
 * @param {string} documentId - Document ID
 * @param {Object} tokens - OAuth tokens
 * @returns {Promise<Object>} - Document content
 */
async function getDocumentContent(documentId, tokens) {
  console.log(`[DocumentService] Getting document content for document: ${documentId}`);
  const cacheKey = documentId;
  
  // Check cache first
  if (documentCache.has(cacheKey)) {
    console.log(`[DocumentService] Using cached content for document: ${documentId}`);
    console.log(`[DocumentService] Cached content:`, documentCache.get(cacheKey));
    return documentCache.get(cacheKey);
  }
  
  console.log(`[DocumentService] No cached content found for document: ${documentId}, fetching from Google Docs`);
  
  try {
    const docsClient = createDocsClient(tokens);
    console.log(`[DocumentService] Sending request to Google Docs API for document: ${documentId}`);
    const response = await docsClient.documents.get({
      documentId: documentId
    });
    
    console.log(`[DocumentService] Received document data from Google Docs API for document: ${documentId}`);
    const extractedContent = extractDocumentContent(response.data);
    
    // Log the extracted content details
    console.log(`[DocumentService] Document title: ${extractedContent.title}`);
    console.log(`[DocumentService] Document content length: ${extractedContent.content.length} characters`);
    console.log(`[DocumentService] Document content preview: ${extractedContent.content.substring(0, 100)}...`);
    
    // Store the document data in a consistent format
    // Ensure content is properly structured as a string, not an object
    const documentData = { 
      id: documentId, 
      content: {
        title: extractedContent.title,
        content: extractedContent.content // This is a string
      }
    };
    
    // Log the final document structure for debugging
    console.log(`[DocumentService] Document structure:`, {
      id: documentData.id,
      contentType: typeof documentData.content,
      hasTitle: !!documentData.content.title,
      contentValueType: typeof documentData.content.content,
      contentLength: documentData.content.content.length
    });
    
    documentCache.set(cacheKey, documentData);
    
    console.log(`[DocumentService] Successfully processed and cached document: ${documentId}`);
    return documentData;
  } catch (error) {
    console.error(`[DocumentService] Error fetching document ${documentId}:`, error);
    throw error;
  }
}

/**
 * Extract and format content from a document
 * @param {Object} document - Google Doc document object
 * @returns {Object} - Formatted document content
 */
function extractDocumentContent(document) {
  if (!document || !document.body || !document.body.content) {
    return { title: 'Unknown Document', content: '' };
  }
  
  const title = document.title || 'Untitled Document';
  let content = '';
  
  // Process document content
  document.body.content.forEach(element => {
    if (element.paragraph) {
      element.paragraph.elements.forEach(paraElement => {
        if (paraElement.textRun && paraElement.textRun.content) {
          content += paraElement.textRun.content;
        }
      });
    }
  });
  
  return {
    title,
    content
  };
}

/**
 * Clear the document cache (primarily for testing)
 */
function clearCache() {
  documentCache.clear();
}

/**
 * Fetch a Google Doc by its ID (Alias for getDocumentContent for backward compatibility)
 * @param {string} documentId - Google Doc ID
 * @param {Object} tokens - OAuth tokens
 * @returns {Promise<Object>} - Document content
 */
async function getDocumentById(documentId, tokens) {
  console.log(`[DocumentService] getDocumentById called (alias for getDocumentContent) for document: ${documentId}`);
  return getDocumentContent(documentId, tokens);
}

/**
 * Refetch documents for an event, clearing cache first
 * @param {Object} event - Calendar event object
 * @param {Object} tokens - OAuth tokens
 * @returns {Promise<Array>} - Array of document objects with fresh content
 */
async function refetchDocumentsForEvent(event, tokens) {
  console.log(`[DocumentService] Refetching documents for event: ${event.id}`);
  
  // Clear document cache first
  clearDocumentCache(event.id);
  
  // Get fresh documents
  const documents = await getDocumentsForEvent(event, tokens);
  
  // Pre-fetch content for all documents to ensure cache is populated
  if (documents && documents.length > 0) {
    console.log(`[DocumentService] Pre-fetching fresh content for ${documents.length} documents`);
    await Promise.all(documents.map(doc => 
      getDocumentContent(doc.id, tokens)
        .then(() => console.log(`[DocumentService] Successfully pre-fetched fresh content for document ${doc.id}`))
        .catch(err => console.error(`[DocumentService] Error pre-fetching fresh content for document ${doc.id}:`, err))
    ));
  }
  
  return documents;
}

module.exports = {
  getDocumentContent,
  getDocumentById,        // Keep for backward compatibility
  getDocumentsForEvent,
  extractDocumentContent,
  clearCache,
  clearDocumentCache,     // Clear cache for a specific meeting
  refetchDocumentsForEvent // New function to refetch documents with fresh content
};
