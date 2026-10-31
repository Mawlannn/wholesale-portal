document.addEventListener('submit', function (e) { e.preventDefault(); parent.postMessage({ type: 'demo-submit' }, '*'); });
document.addEventListener('click', function (e) {
  var b = e.target.closest('button[aria-label="+"],button[aria-label="−"]');
  if (b) { var i = b.parentElement.querySelector('input'); var v = (parseInt(i.value, 10) || 0) + (b.getAttribute('aria-label') === '+' ? 1 : -1); i.value = Math.max(0, v); e.preventDefault(); return; }
  var a = e.target.closest('a[href]');
  if (a && a.getAttribute('href') === '#') { e.preventDefault(); parent.postMessage({ type: 'demo-nolink' }, '*'); }
});
document.addEventListener('change', function (e) { if (e.target.name === 'lang') parent.postMessage({ type: 'lang', lang: e.target.value }, '*'); });
