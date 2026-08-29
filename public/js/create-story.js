document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-story-form');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('media-input');
  const previewContainer = document.getElementById('preview-container');
  const submitBtn = document.getElementById('submit-btn');
  
  let selectedFile = null;

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      
      const fileUrl = URL.createObjectURL(selectedFile);
      previewContainer.innerHTML = '';
      
      if (selectedFile.type.startsWith('video/')) {
        previewContainer.innerHTML = `<video src="${fileUrl}" controls></video>`;
      } else {
        previewContainer.innerHTML = `<img src="${fileUrl}" alt="Preview" />`;
      }
      previewContainer.style.display = 'block';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      if (typeof showToast === 'function') showToast('Please select an image or video.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('media', selectedFile);
    
    const caption = document.getElementById('caption').value.trim();
    if (caption) formData.append('caption', caption);
    
    formData.append('audience', document.getElementById('audience').value);
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';
      
      await API.postForm('/api/stories', formData);
      
      if (typeof showToast === 'function') showToast('Story posted!', 'success');
      setTimeout(() => {
        window.location.href = '/feed.html';
      }, 1000);
    } catch (err) {
      console.error('Error posting story:', err);
      if (typeof showToast === 'function') showToast('Failed to post story', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Story';
    }
  });
});
