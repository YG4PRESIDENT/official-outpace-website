// Simple Intersection Observer for scroll animations
document.addEventListener('DOMContentLoaded', () => {
  // --- Kinetic Text Reveal ---
  const kineticText = document.querySelector('.kinetic-text');
  if (kineticText) {
    const text = kineticText.innerText;
    kineticText.innerHTML = '';
    // Split by words to keep it readable, or characters for more aggression
    // Let's do words for "WALK TOGETHER"
    const words = ["WALK", "TOGETHER."];

    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = word + " ";
      span.style.animationDelay = `${index * 0.2}s`;
      kineticText.appendChild(span);
      if (index === 0) kineticText.appendChild(document.createElement('br'));
    });
  }

  // --- Living Phone Chat Sequence ---
  const chatContainer = document.getElementById('chat-container');
  const stepCount = document.getElementById('step-count');
  const rankDisplay = document.getElementById('rank-display');

  const chatSequence = [
    { type: 'incoming', text: 'Just hit 10k steps! 🏃‍♂️', delay: 1000 },
    { type: 'incoming', text: 'Try to keep up 😉', delay: 2500 },
    { type: 'outgoing', text: 'Nice. Watch this.', delay: 4500 },
    { type: 'system', text: 'You have outpaced Sarah!', delay: 6500 },
    { action: 'updateStats', delay: 6500 }
  ];

  if (chatContainer) {
    let currentTime = 0;

    chatSequence.forEach(msg => {
      setTimeout(() => {
        if (msg.action === 'updateStats') {
          // Update stats animation
          stepCount.textContent = "12,403";
          stepCount.classList.add('rank-update');
          rankDisplay.textContent = "#1";
          rankDisplay.classList.add('rank-update');
        } else {
          // Add chat bubble
          const bubble = document.createElement('div');
          bubble.classList.add('chat-bubble', msg.type);
          bubble.textContent = msg.text;
          chatContainer.appendChild(bubble);

          // Scroll to bottom of chat
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, msg.delay);
    });
  }

  // --- Scroll Animations ---
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  const animatedElements = document.querySelectorAll('.feature-item, .hero-actions, p.animate-in');
  animatedElements.forEach(el => observer.observe(el));
});
