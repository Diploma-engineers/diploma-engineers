document.addEventListener("DOMContentLoaded", () => {
  initCounterAnimation();
});

function initCounterAnimation() {
  const counterNumbers = document.querySelectorAll(".counter-number");
  let animated = false;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !animated) {
          counterNumbers.forEach((counter) => runCounter(counter));
          animated = true; // Prevents re-triggering
        }
      });
    },
    { threshold: 0.5 }
  );

  const counterSection = document.querySelector(".counter-section");
  if (counterSection) observer.observe(counterSection);
}

function runCounter(element) {
  const target = +element.getAttribute("data-target");
  const duration = 2000; // Total time in ms
  const stepTime = 20;
  const steps = duration / stepTime;
  const increment = target / steps;

  let current = 0;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.innerText = target.toLocaleString() + "+";
      clearInterval(timer);
    } else {
      element.innerText = Math.ceil(current).toLocaleString() + "+";
    }
  }, stepTime);
}

