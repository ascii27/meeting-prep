/**
 * Document Service
 * Handles fetching and processing Google Docs associated with calendar events
 */

const { google } = require('googleapis');

// Cache for document content to improve performance
const documentCache = new Map();

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
  
  // If no documents found, check for recently accessed documents in the cache
  if (docs.length === 0) {
    console.log(`[DocumentService] No attachments found for event: ${event.id}, checking cache for recently accessed documents`);
    
    // Get all keys from the document cache
    const cachedDocIds = Array.from(documentCache.keys());
    
    if (cachedDocIds.length > 0) {
      console.log(`[DocumentService] Found ${cachedDocIds.length} recently accessed documents in cache`);
      
      // Use the most recently accessed document
      const docId = cachedDocIds[cachedDocIds.length - 1];
      const cachedDoc = documentCache.get(docId);
      
      if (cachedDoc) {
        console.log(`[DocumentService] Using recently accessed document: ${docId} for meeting ${event.id}`);
        
        // Extract title from the cached document content
        const title = cachedDoc.content && cachedDoc.content.title ? 
          cachedDoc.content.title : 'Recently Accessed Document';
        
        docs.push({
          id: docId,
          title: title,
          url: `https://docs.google.com/document/d/${docId}/edit`
        });
      }
    } else {
      console.log(`[DocumentService] No recently accessed documents found in cache for event: ${event.id}`);
      console.log(`[DocumentService] Consider implementing additional document sources like shared drives or recent docs`);
    }
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
    const documentData = { 
      id: documentId, 
      content: extractedContent // Keep the original structure with title and content
    };
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

module.exports = {
  getDocumentContent,
  getDocumentById,        // Keep for backward compatibility
  getDocumentsForEvent,
  extractDocumentContent,
  clearCache
};
