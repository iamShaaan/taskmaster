/**
 * Triggers a file download by fetching the URL as a blob.
 * This bypasses cross-origin restrictions that normally cause the browser to
 * open the file (like an image or PDF) instead of downloading it.
 */
export const triggerDownload = async (url: string, filename: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the object URL to free memory
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Download failed:', error);
        // Fallback: open in new tab if blob fetch fails
        window.open(url, '_blank');
    }
};
