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

  // --- Waitlist Modal Logic ---
  const modal = document.getElementById('waitlist-modal');
  const openBtn = document.getElementById('join-waitlist-btn');
  const closeBtn = document.getElementById('close-modal');
  const form = document.getElementById('waitlist-form');
  const status = document.getElementById('form-status');

  if (openBtn && modal) {
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      status.textContent = '';
      status.className = 'form-status';
      modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    // Handle Form Submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const emailInput = form.querySelector('input[name="email"]');
      const email = emailInput.value.trim();

      // Basic Email Validation Regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        status.textContent = "ENTER A VALID EMAIL.";
        status.className = "form-status error";
        return; // Stop submission
      }

      status.textContent = "CONNECTING TO SERVER...";
      status.className = "form-status";

      // REPLACE THIS URL WITH YOUR GOOGLE SCRIPT URL
      const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxBph3TC1UlSdDWvuSY3INkpjg62u2PtO-ZDZ_xgfl__D2g-Iwfon5NT3Oqs-ZwbxEd_Q/exec';

      try {
        if (GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
          throw new Error("Script URL not set");
        }

        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: data,
          mode: 'no-cors' // Important for Google Sheets
        });

        status.textContent = "YOU ARE ON THE LIST.";
        status.classList.add('success');
        form.reset();
        setTimeout(() => modal.classList.remove('active'), 2000);

      } catch (error) {
        console.error('Error:', error);
        // Fallback for demo purposes if URL isn't set yet
        if (error.message === "Script URL not set") {
          status.textContent = "DEMO MODE: SUCCESS (Set URL to save)";
          status.classList.add('success');
          setTimeout(() => modal.classList.remove('active'), 2000);
        } else {
          status.textContent = "CONNECTION FAILED. TRY AGAIN.";
          status.classList.add('error');
        }
      }
    });
  }
});
