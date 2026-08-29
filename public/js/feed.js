let page = 1;

document.addEventListener('DOMContentLoaded', () => {
  fetchFeed();

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      page++;
      fetchFeed();
    });
  }
});

async function fetchFeed() {
  try {
    // Assuming API is a globally available object for API requests
    const response = await API.get('/api/posts/feed?page=' + page);
    // The response data format depends on your API, here we assume it returns an array of posts
    const posts = response.data || response.posts || response; 
    
    renderPosts(posts);
  } catch (error) {
    console.error('Error fetching feed:', error);
    showToast('Failed to load feed', 'error');
  }
}

function renderPosts(posts) {
  const container = document.getElementById('feed-container');
  const loadMoreBtn = document.getElementById('load-more-btn');

  if (page === 1 && (!posts || posts.length === 0)) {
    container.innerHTML = '<p class="empty-state">Follow people to see their posts here.</p>';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  if (posts && posts.length > 0) {
    posts.forEach(post => {
      container.appendChild(createPostCard(post));
    });
    if (loadMoreBtn) loadMoreBtn.style.display = 'block';
  } else {
    // No more posts to load
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  }
}

function createPostCard(post) {
  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.id = post._id;

  const author = post.author || {};
  const avatarUrl = author.avatar || '/images/default-avatar.png';
  const username = author.username || 'unknown';
  const location = post.location ? `<div class="post-location">${post.location}</div>` : '';

  // Handle Media (simple carousel logic if multiple, though just rendering one here for simplicity if not fully implemented)
  let mediaHtml = '';
  if (post.media && post.media.length > 0) {
    // Just showing the first media item for now, could be expanded into a carousel
    const media = post.media[0];
    if (media.type === 'video') {
      mediaHtml = `<video src="${media.url}" controls class="post-media"></video>`;
    } else {
      mediaHtml = `<img src="${media.url}" alt="Post media" class="post-media">`;
    }
  }

  const isLiked = post.isLiked || false;
  const likeClass = isLiked ? 'liked' : '';
  const likesCount = post.likesCount || 0;

  card.innerHTML = `
    <div class="post-header">
      <img src="${avatarUrl}" alt="${username}'s avatar" class="author-avatar">
      <div class="author-info">
        <div class="author-username">${username}</div>
        ${location}
      </div>
    </div>
    <div class="post-media-container">
      ${mediaHtml}
    </div>
    <div class="post-actions">
      <button class="action-btn like-btn ${likeClass}">Like</button>
      <button class="action-btn comment-btn">Comment</button>
      <button class="action-btn share-btn">Share</button>
      <button class="action-btn save-btn">Save</button>
    </div>
    <div class="post-likes"><span>${likesCount}</span> likes</div>
    <div class="post-caption">
      <span class="caption-username">${username}</span>
      <span class="caption-text">${post.caption || ''}</span>
    </div>
    <div class="post-timestamp">${new Date(post.createdAt || Date.now()).toLocaleString()}</div>
  `;

  // Bind Like Event
  const likeBtn = card.querySelector('.like-btn');
  likeBtn.addEventListener('click', async () => {
    try {
      // Assuming this endpoint toggles the like status or handles the POST request
      await API.post(`/api/posts/${post._id}/like`);
      
      const currentlyLiked = likeBtn.classList.toggle('liked');
      const likesEl = card.querySelector('.post-likes span');
      let currentLikesCount = parseInt(likesEl.textContent, 10);
      
      if (currentlyLiked) {
        currentLikesCount++;
      } else {
        currentLikesCount--;
      }
      likesEl.textContent = currentLikesCount;
    } catch (error) {
      console.error('Error liking post:', error);
      showToast('Error liking post', 'error');
    }
  });

  // Bind Comment Event
  const commentBtn = card.querySelector('.comment-btn');
  commentBtn.addEventListener('click', () => {
    window.location.href = '/post.html?id=' + post._id;
  });

  return card;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
