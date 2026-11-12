document.querySelectorAll('[data-go]').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.remove('active');
    });
    document.getElementById(b.dataset.go).classList.add('active');
  });
});
