function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function setText(selector, value, root = document) {
  const node = qs(selector, root);
  if (node) {
    node.textContent = value;
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    qs,
    qsa,
    setText,
  };
}
