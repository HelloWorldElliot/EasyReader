chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
chrome.tabs.onActivated.addListener((activeInfo) => {
  showSummary(activeInfo.tabId);
});
chrome.tabs.onUpdated.addListener(async (tabId) => {
  showSummary(tabId);
});
async function showSummary(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url.startsWith("http")) {
    return;
  }
  try {
    // Inject a script into the tab to extract the page's text content
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const articleElement = document.querySelector("article");
        return articleElement
          ? articleElement.innerText.trim()
          : "No <article> element found on this page.";
      },
    });

    // Save the extracted text in session storage
    chrome.storage.session.set({ pageContent: result.result });
    console.log("Extracted Text:", result.result); // For debugging
  } catch (error) {
    console.error("Failed to extract text:", error);
  }
}
// Create the context menu when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "highlightedTextAction",
    title: "Analyze with EasyReader",
    contexts: ["selection"], // This ensures it only shows when text is selected
  });
});

// Add a listener for when the context menu item is clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "highlightedTextAction") {
    const selectedText = info.selectionText;
    if (selectedText) {
      console.log("Selected Text (from context menu):", selectedText);
      // You can process the selected text here or send it to the background script
      chrome.runtime.sendMessage({
        type: "selectedTextFromBackground",
        text: selectedText,
      });
    }
  }
});
