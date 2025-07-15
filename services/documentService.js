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
  
  return docs;
}

/**
 * Fetch a Google Doc by its ID
 * @param {string} documentId - Google Doc ID
 * @param {Object} tokens - OAuth tokens
 * @returns {Promise<Object>} - Document content
 */
async function getDocumentById(documentId, tokens) {
  // Check cache first
  const cacheKey = `${documentId}`;
  if (documentCache.has(cacheKey)) {
    return documentCache.get(cacheKey);
  }
  
  try {
    const docsClient = createDocsClient(tokens);
    const response = await docsClient.documents.get({
      documentId: documentId
    });
    
    // Cache the document content
    documentCache.set(cacheKey, response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching document:', error);
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

module.exports = {
  getDocumentById,
  getDocumentsForEvent,
  extractDocumentContent,
  clearCache
};
