document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('reels-container');
  let reels = [];

  try {
    reels = await API.get('/api/reels/feed');
    renderReels();
  } catch (error) {
    console.error('Error fetching reels:', error);
    container.innerHTML = '<div style="color: white; padding: 2rem; text-align: center;">Failed to load reels.</div>';
  }

  function renderReels() {
    if (!reels || reels.length === 0) {
      container.innerHTML = '<div style="color: white; padding: 2rem; text-align: center;">No reels found.</div>';
      return;
    }

    container.innerHTML = reels.map(reel => `
      <div class="reel-item" id="reel-${reel._id}">
        <video class="reel-video" src="${reel.videoUrl}" loop playsinline></video>
        <div class="reel-info">
          <h3>@${reel.user?.username || 'unknown'}</h3>
          <p>${reel.caption || ''}</p>
        </div>
        <div class="reel-actions">
          <button class="like-btn ${reel.isLiked ? 'liked' : ''}" data-id="${reel._id}">
            ♥
          </button>
          <span>${reel.likesCount || 0}</span>
        </div>
      </div>
    `).join('');

    setupInteractions();
  }

  function setupInteractions() {
    // Handle likes
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reelId = e.target.dataset.id;
        try {
          // Assume toggle behavior via POST
          await API.post(`/api/reels/${reelId}/like`);
          e.target.classList.toggle('liked');
          const countSpan = e.target.nextElementSibling;
          let count = parseInt(countSpan.textContent) || 0;
          countSpan.textContent = e.target.classList.contains('liked') ? count + 1 : Math.max(0, count - 1);
        } catch (error) {
          console.error('Error liking reel:', error);
        }
      });
    });

    // Handle autoplay using IntersectionObserver
    const videos = document.querySelectorAll('.reel-video');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(err => console.log('Autoplay prevented:', err));
        } else {
          video.pause();
          video.currentTime = 0; // reset when out of view
        }
      });
    }, { threshold: 0.6 });

    videos.forEach(video => observer.observe(video));
    
    // Toggle play/pause on click
    videos.forEach(video => {
      video.addEventListener('click', () => {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
      });
    });

    // Check if ID is in hash (e.g. redirected from explore.html)
    if (window.location.hash) {
      const hashId = window.location.hash.replace('#id=', '');
      if (hashId) {
        const targetReel = document.getElementById(`reel-${hashId}`);
        if (targetReel) {
          targetReel.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }
});
