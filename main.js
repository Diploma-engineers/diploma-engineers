document.addEventListener("DOMContentLoaded", () => {
  initScrollProgress();
  initBackToTop();
});

/* Reading Scroll Progress Bar */
function initScrollProgress() {
  const progressBar = document.getElementById("scroll-progress");

  window.addEventListener("scroll", () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / totalHeight) * 100;
    if (progressBar) progressBar.style.width = `${progress}%`;
  });
}

/* Back to Top Floating Button Handler */
function initBackToTop() {
  const topBtn = document.getElementById("back-to-top");

  if (!topBtn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 400) {
      topBtn.classList.add("show");
    } else {
      topBtn.classList.remove("show");
    }
  });

  topBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}
