const axios = require('axios');

async function testProxy() {
  console.log('🧪 Тестируем прокси-сервер...');
  
  try {
    // Тестируем прокси для Rutube
    const videoId = '1234567890abcdef'; // Тестовый ID
    console.log('📡 Тестируем прокси для Rutube видео:', videoId);
    
    const response = await axios.get(`http://localhost:3006/proxy/rutube/${videoId}`);
    console.log('✅ Прокси ответ:', response.data);
    
    // Тестируем iframe страницу
    console.log('📡 Тестируем iframe страницу...');
    const iframeResponse = await axios.get(`http://localhost:3006/iframe/${videoId}`);
    console.log('✅ iframe страница загружена, размер:', iframeResponse.data.length, 'байт');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования прокси:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Прокси-сервер не запущен. Запустите: node server/proxy.js');
    }
  }
}

testProxy(); 