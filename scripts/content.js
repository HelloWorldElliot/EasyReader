// Function to get the selected text
function getSelectedText() {
  const selection = window.getSelection();
  return selection.toString().trim();
}

// Function to handle the selected text
function handleSelectedText() {
  const selectedText = getSelectedText();
  if (selectedText) {
    console.log("Selected Text: ", selectedText);

    // You can send this selected text to the background script if needed
    chrome.runtime.sendMessage({ type: "selectedText", text: selectedText });
  } else {
    console.log("No text selected.");
  }
}

// Call the function when content.js is injected
handleSelectedText();
