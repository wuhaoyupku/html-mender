(() => {
  const ns = window.HtmlSlideMenderExtension = window.HtmlSlideMenderExtension || {};

  function placeCaretAtEnd(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretFromPoint(element, x, y) {
    const range = document.caretRangeFromPoint?.(x, y) || caretPositionRangeFromPoint(x, y);
    if (!range || !rangeBelongsTo(range, element)) {
      placeCaretAtEnd(element);
      return;
    }

    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function caretPositionRangeFromPoint(x, y) {
    const position = document.caretPositionFromPoint?.(x, y);
    if (!position) {
      return null;
    }
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    return range;
  }

  function selectElementContents(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function rangeBelongsTo(range, element) {
    return nodeBelongsTo(range.startContainer, element) &&
      nodeBelongsTo(range.endContainer, element) &&
      nodeBelongsTo(range.commonAncestorContainer, element);
  }

  function nodeBelongsTo(node, element) {
    return node === element ||
      element.contains(node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
  }

  ns.selection = {
    placeCaretAtEnd,
    placeCaretFromPoint,
    selectElementContents,
    rangeBelongsTo
  };
})();
