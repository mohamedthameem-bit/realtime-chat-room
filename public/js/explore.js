document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('explore-grid');

  try {
    const items = await API.get('/api/explore');
    renderExplore(items);
  } catch (error) {
    console.error('Error fetching explore items:', error);
    grid.innerHTML = '<p>Failed to load explore items.</p>';
  }

  function renderExplore(items) {
    if (!items || items.length === 0) {
      grid.innerHTML = '<p>No content to explore yet.</p>';
      return;
    }

    grid.innerHTML = items.map(item => {
      const isReel = item.type === 'reel';
      
      // Determine media URL
      let mediaUrl = '';
      if (isReel) {
        mediaUrl = item.videoUrl;
      } else {
        mediaUrl = (item.mediaUrls && item.mediaUrls.length > 0) ? item.mediaUrls[0] : '';
      }
      
      // Determine HTML tag
      const mediaElement = isReel 
        ? `<video src="${mediaUrl}" muted playsinline></video>`
        : `<img src="${mediaUrl || '/default-placeholder.png'}" alt="Explore item" />`;
      
      const icon = isReel ? '<span class="icon">Reel</span>' : '';
      const link = isReel ? `/reels.html#id=${item._id}` : `/post.html?id=${item._id}`;

      return `
        <div class="explore-item" onclick="window.location.href='${link}'">
          ${mediaElement}
          ${icon}
        </div>
      `;
    }).join('');
    
    // Autoplay short previews of videos on hover (optional enhancement)
    const exploreItems = document.querySelectorAll('.explore-item video');
    exploreItems.forEach(video => {
      video.addEventListener('mouseenter', () => video.play().catch(() => {}));
      video.addEventListener('mouseleave', () => {
        video.pause();
        video.currentTime = 0;
      });
    });
  }
});
