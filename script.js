document.addEventListener("DOMContentLoaded", function () {
  
  // 1. Header and Footer HTML Loading Function
  loadExternalHTML("header-container", "header.html");
  loadExternalHTML("footer-container", "footer.html");

  function loadExternalHTML(elementId, fileName) {
    fetch(fileName)
      .then(response => {
        if (response.ok) return response.text();
        throw new Error('File not found: ' + fileName);
      })
      .then(data => {
        document.getElementById(elementId).innerHTML = data;
      })
      .catch(error => console.log(error));
  }

  // 2. Initialize AOS (Animate On Scroll)
  AOS.init({
    duration: 800,
    once: true
  });

  // 3. Initialize Swiper Slider (Feedback)
  new Swiper('.feedback-slider', {
    loop: true,
    autoplay: {
      delay: 3500,
      disableOnInteraction: false,
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
  });

  // 4. Archives Number Counter Animation
  const counters = document.querySelectorAll('.counter');
  let counterTriggered = false;

  window.addEventListener('scroll', () => {
    const counterSection = document.querySelector('.counter-section');
    if (!counterSection) return;

    const sectionPos = counterSection.getBoundingClientRect().top;
    const screenPos = window.innerHeight / 1.3;

    if (sectionPos < screenPos && !counterTriggered) {
      counterTriggered = true;
      counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        let count = 0;
        const speed = target / 100;

        const updateCount = () => {
          count += speed;
          if (count < target) {
            counter.innerText = Math.ceil(count);
            setTimeout(updateCount, 25);
          } else {
            counter.innerText = target + "+";
          }
        };
        updateCount();
      });
    }
  });

});

