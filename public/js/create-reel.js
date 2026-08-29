document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('create-reel-form');
  const messageDiv = document.getElementById('message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageDiv.textContent = 'Uploading reel...';
    messageDiv.style.color = '#333';
    
    const formData = new FormData(form);
    
    try {
      const response = await API.postForm('/api/reels', formData);
      messageDiv.textContent = 'Reel created successfully!';
      messageDiv.style.color = 'green';
      form.reset();
      
      setTimeout(() => {
        window.location.href = '/reels.html';
      }, 2000);
    } catch (error) {
      console.error('Error creating reel:', error);
      messageDiv.textContent = error.message || 'Failed to create reel.';
      messageDiv.style.color = 'red';
    }
  });
});
