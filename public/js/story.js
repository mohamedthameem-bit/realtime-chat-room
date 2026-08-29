document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId'); // which user's story to view
  
  const viewer = document.getElementById('story-viewer');
  let currentStories = [];
  let currentIndex = 0;
  let progressTimer = null;
  const STORY_DURATION = 5000; // 5 seconds per image

  try {
    const res = await API.get('/api/stories/feed');
    // feed returns grouped stories: [{ author: User, stories: [Story] }]
    if (userId) {
      const group = res.find(g => g.author._id === userId);
      if (group) currentStories = group.stories;
    } else if (res.length > 0) {
      currentStories = res[0].stories;
    }

    if (currentStories.length === 0) {
      viewer.innerHTML = '<div style="color:white;text-align:center;margin-top:50%;">No stories found.</div>';
      setTimeout(() => window.location.href = '/feed.html', 1500);
      return;
    }

    renderStory();
  } catch (err) {
    console.error('Failed to load stories', err);
    viewer.innerHTML = '<div style="color:white;text-align:center;margin-top:50%;">Failed to load stories.</div>';
  }

  function renderStory() {
    clearTimeout(progressTimer);
    const story = currentStories[currentIndex];
    if (!story) return;

    const author = story.author || {};
    const avatarUrl = author.profilePic || '';
    const username = author.username || 'unknown';
    const timeAgo = new Date(story.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    let mediaHtml = '';
    if (story.mediaType === 'video') {
      mediaHtml = `<video src="${story.mediaUrl}" autoplay class="story-media" id="story-video"></video>`;
    } else {
      mediaHtml = `<img src="${story.mediaUrl}" class="story-media" />`;
    }

    let progressHtml = '<div class="progress-container">';
    for (let i = 0; i < currentStories.length; i++) {
      let width = i < currentIndex ? '100%' : (i === currentIndex ? '0%' : '0%');
      progressHtml += `<div class="progress-bar"><div class="progress-bar-fill" id="pb-${i}" style="width: ${width};"></div></div>`;
    }
    progressHtml += '</div>';

    viewer.innerHTML = `
      ${progressHtml}
      <div class="story-header">
        ${avatarUrl ? `<img src="${avatarUrl}" class="story-avatar">` : ''}
        <span class="story-username">${username}</span>
        <span class="story-time">${timeAgo}</span>
        <button class="story-close" onclick="window.location.href='/feed.html'">×</button>
      </div>
      <div class="story-media-container">
        ${mediaHtml}
        ${story.caption ? `<div class="story-caption">${story.caption}</div>` : ''}
      </div>
      <div class="story-controls">
        <div class="control-left" id="ctrl-left"></div>
        <div class="control-right" id="ctrl-right"></div>
      </div>
      <div class="story-footer">
        <input type="text" class="reply-input" placeholder="Reply to ${username}..." />
        <button class="react-btn">❤️</button>
      </div>
    `;

    document.getElementById('ctrl-left').addEventListener('click', prevStory);
    document.getElementById('ctrl-right').addEventListener('click', nextStory);

    const video = document.getElementById('story-video');
    const activePb = document.getElementById(`pb-${currentIndex}`);

    if (video) {
      video.onended = nextStory;
      video.ontimeupdate = () => {
        if (video.duration) {
          activePb.style.width = (video.currentTime / video.duration * 100) + '%';
        }
      };
    } else {
      // Simulate progress for image
      let start = Date.now();
      const updateProgress = () => {
        let elapsed = Date.now() - start;
        let pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
        activePb.style.width = pct + '%';
        if (pct < 100) {
          progressTimer = requestAnimationFrame(updateProgress);
        } else {
          nextStory();
        }
      };
      progressTimer = requestAnimationFrame(updateProgress);
    }
  }

  function nextStory() {
    if (currentIndex < currentStories.length - 1) {
      currentIndex++;
      renderStory();
    } else {
      window.location.href = '/feed.html';
    }
  }

  function prevStory() {
    if (currentIndex > 0) {
      currentIndex--;
      renderStory();
    }
  }
});
