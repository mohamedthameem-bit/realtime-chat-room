document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');
  
  if (!postId) {
    if (typeof showToast === 'function') showToast('Post not found', 'error');
    window.location.href = '/feed.html';
    return;
  }
  
  const postContainer = document.getElementById('post-container');
  const commentsList = document.getElementById('comments-list');
  const commentInput = document.getElementById('comment-input');
  const submitCommentBtn = document.getElementById('submit-comment');
  
  let currentUser = null;
  
  async function loadData() {
    try {
      // Get current user for permissions
      try {
        currentUser = await API.get('/api/users/me');
      } catch (err) {
        console.warn('Could not load current user', err);
      }
      
      await loadPost();
      await loadComments();
    } catch (error) {
      console.error('Error loading post data:', error);
      if (typeof showToast === 'function') showToast('Error loading post', 'error');
    }
  }
  
  async function loadPost() {
    try {
      const post = await API.get(`/api/posts/${postId}`);
      renderPost(post);
    } catch (error) {
      console.error('Error loading post:', error);
      postContainer.innerHTML = '<p>Post not found or deleted.</p>';
      document.getElementById('comments-section').style.display = 'none';
      throw error;
    }
  }
  
  function renderPost(post) {
    const isAuthor = currentUser && post.author && (currentUser._id === post.author._id || currentUser._id === post.author);
    
    let mediaHtml = '';
    if (post.mediaUrl) {
      if (post.mediaType === 'video') {
        mediaHtml = `<video src="${post.mediaUrl}" controls class="post-media"></video>`;
      } else {
        mediaHtml = `<img src="${post.mediaUrl}" alt="Post media" class="post-media">`;
      }
    }
    
    const authorName = post.author && post.author.username ? post.author.username : 'Unknown User';
    
    postContainer.innerHTML = `
      <div class="post card">
        <div class="post-header">
          <div class="post-author-info">
            <span class="author-name">${authorName}</span>
          </div>
          ${isAuthor ? `<button class="btn btn-danger btn-sm" id="delete-post-btn">Delete Post</button>` : ''}
        </div>
        ${mediaHtml}
        <div class="post-body">
          <p class="post-content">${post.content || ''}</p>
        </div>
        <div class="post-actions">
          <button class="action-btn like-post-btn" data-id="${post._id}">
            <i class="${post.isLiked ? 'fas' : 'far'} fa-heart"></i>
            <span class="likes-count">${post.likesCount || (post.likes ? post.likes.length : 0)}</span>
          </button>
        </div>
      </div>
    `;
    
    // Attach event listeners
    const likeBtn = postContainer.querySelector('.like-post-btn');
    if (likeBtn) {
      likeBtn.addEventListener('click', async () => {
        try {
          await API.post(`/api/posts/${postId}/like`);
          await loadPost();
        } catch (err) {
          if (typeof showToast === 'function') showToast('Failed to like post', 'error');
        }
      });
    }
    
    const deleteBtn = postContainer.querySelector('#delete-post-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this post?')) {
          try {
            await API.delete(`/api/posts/${postId}`);
            if (typeof showToast === 'function') showToast('Post deleted', 'success');
            setTimeout(() => {
              window.location.href = '/feed.html';
            }, 1000);
          } catch (err) {
            if (typeof showToast === 'function') showToast('Failed to delete post', 'error');
          }
        }
      });
    }
  }
  
  async function loadComments() {
    try {
      const comments = await API.get(`/api/comments?targetType=post&targetId=${postId}`);
      renderComments(comments);
    } catch (error) {
      console.error('Error loading comments:', error);
      commentsList.innerHTML = '<p>Error loading comments.</p>';
    }
  }
  
  function renderComments(comments) {
    if (!comments || comments.length === 0) {
      commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
      return;
    }
    
    commentsList.innerHTML = '';
    comments.forEach(comment => {
      const authorName = comment.author && comment.author.username ? comment.author.username : 'Unknown User';
      const text = comment.text || comment.content || '';
      
      const commentEl = document.createElement('div');
      commentEl.className = 'comment';
      commentEl.innerHTML = `
        <div class="comment-content">
          <strong>${authorName}</strong>
          <span>${text}</span>
        </div>
        <div class="comment-actions">
          <button class="action-btn like-comment-btn" data-id="${comment._id}">
            <i class="${comment.isLiked ? 'fas' : 'far'} fa-heart"></i>
            <span class="likes-count">${comment.likesCount || (comment.likes ? comment.likes.length : 0)}</span>
          </button>
        </div>
      `;
      commentsList.appendChild(commentEl);
      
      const likeBtn = commentEl.querySelector('.like-comment-btn');
      likeBtn.addEventListener('click', async () => {
        try {
          await API.post(`/api/comments/${comment._id}/like`);
          await loadComments();
        } catch (err) {
          if (typeof showToast === 'function') showToast('Failed to like comment', 'error');
        }
      });
    });
  }
  
  // Submit new comment
  submitCommentBtn.addEventListener('click', async () => {
    const text = commentInput.value.trim();
    if (!text) return;
    
    try {
      submitCommentBtn.disabled = true;
      await API.post('/api/comments', {
        targetType: 'post',
        targetId: postId,
        text: text
      });
      commentInput.value = '';
      if (typeof showToast === 'function') showToast('Comment added', 'success');
      await loadComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
      if (typeof showToast === 'function') showToast('Failed to add comment', 'error');
    } finally {
      submitCommentBtn.disabled = false;
    }
  });
  
  // Enter key to submit comment
  commentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitCommentBtn.click();
    }
  });
  
  // Initialize
  loadData();
});
