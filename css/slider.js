document.addEventListener("DOMContentLoaded", () => {
  initSlider("notification-slider", "slide-prev", "slide-next");
  initSlider("feedback-track", "feed-prev", "feed-next");
});

function initSlider(trackId, prevBtnId, nextBtnId) {
  const track = document.getElementById(trackId);
  const prevBtn = document.getElementById(prevBtnId);
  const nextBtn = document.getElementById(nextBtnId);

  if (!track || !prevBtn || !nextBtn) return;

  let currentIndex = 0;

  function getVisibleCards() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  }

  function updateSlider() {
    const card = track.querySelector(".glass-card");
    if (!card) return;
    
    const cardWidth = card.offsetWidth + 24; // Width + gap
    track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
  }

  nextBtn.addEventListener("click", () => {
    const totalCards = track.children.length;
    const maxIndex = totalCards - getVisibleCards();

    if (currentIndex < maxIndex) {
      currentIndex++;
    } else {
      currentIndex = 0; // Loop back
    }
    updateSlider();
  });

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
    } else {
      currentIndex = 0;
    }
    updateSlider();
  });

  window.addEventListener("resize", updateSlider);
}

