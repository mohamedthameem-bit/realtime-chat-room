/**
 * create-post.js - Logic for creating new posts
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-post-form');
  const mediaInput = document.getElementById('media-input');
  const dropZone = document.getElementById('drop-zone');
  const previewContainer = document.getElementById('preview-container');
  const captionInput = document.getElementById('caption');
  const captionCount = document.getElementById('caption-count');
  const locationInput = document.getElementById('location');
  const visibilitySelect = document.getElementById('visibility');
  const disableCommentsCheckbox = document.getElementById('disable-comments');
  const submitBtn = document.getElementById('submit-btn');
  
  let selectedFiles = [];

  // Update character count
  captionInput.addEventListener('input', () => {
    captionCount.textContent = captionInput.value.length;
  });

  // Drag and drop handlers
  dropZone.addEventListener('click', () => mediaInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  mediaInput.addEventListener('change', () => {
    if (mediaInput.files && mediaInput.files.length > 0) {
      handleFiles(Array.from(mediaInput.files));
      mediaInput.value = ''; // reset so same files can be selected again if needed
    }
  });

  function handleFiles(files) {
    const hasVideo = selectedFiles.some(f => f.type.startsWith('video/')) || files.some(f => f.type.startsWith('video/'));
    
    if (hasVideo && (selectedFiles.length > 0 || files.length > 1)) {
      showToast('You can only upload 1 video, and it cannot be mixed with images.', 'error');
      return;
    }

    if (selectedFiles.length + files.length > 10) {
      showToast('You can only upload up to 10 images.', 'error');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    let hasInvalidFiles = false;

    files.forEach(file => {
      if (!validTypes.includes(file.type)) {
         hasInvalidFiles = true;
         return;
      }
      selectedFiles.push(file);
    });

    if (hasInvalidFiles) {
      showToast('Some files were ignored due to unsupported type.', 'error');
    }

    renderPreviews();
  }

  function renderPreviews() {
    previewContainer.innerHTML = '';
    
    if (selectedFiles.length === 0) {
      previewContainer.style.display = 'none';
      return;
    }
    
    previewContainer.style.display = 'flex';
    
    selectedFiles.forEach((file, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-item';
      
      let mediaElement;
      if (file.type.startsWith('video/')) {
        mediaElement = document.createElement('video');
        mediaElement.src = URL.createObjectURL(file);
        mediaElement.muted = true;
        mediaElement.autoplay = true;
        mediaElement.loop = true;
      } else {
        mediaElement = document.createElement('img');
        mediaElement.src = URL.createObjectURL(file);
      }
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove file';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        renderPreviews();
      };
      
      wrapper.appendChild(mediaElement);
      wrapper.appendChild(removeBtn);
      previewContainer.appendChild(wrapper);
    });
  }

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      showToast('Please select at least one photo or video to upload.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sharing...';

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('media', file);
    });
    
    formData.append('caption', captionInput.value.trim());
    formData.append('location', locationInput.value.trim());
    formData.append('visibility', visibilitySelect.value);
    formData.append('disableComments', disableCommentsCheckbox.checked);

    try {
      if (typeof API === 'undefined') {
        throw new Error('API utility is missing');
      }

      // Use API.postForm for FormData submission
      await API.postForm('/api/posts', formData);
      
      showToast('Post created successfully!', 'success');
      
      setTimeout(() => {
        window.location.href = '/feed.html';
      }, 1500);
      
    } catch (error) {
      console.error('Create post error:', error);
      showToast(error.message || 'An error occurred while sharing your post.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Share Post';
    }
  });

  // Utility to show toasts
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
