import React, { useRef, useEffect, useState } from 'react';
import './VideoPlayer.css';

interface VideoPlayerProps {
  url: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onSeek: (time: number) => void;
  onUrlChange: (url: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onTimeUpdate,
  onDurationChange,
  onSeek,
  onUrlChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [inputUrl, setInputUrl] = useState(url);
  const [showUrlInput, setShowUrlInput] = useState(!url);
  const [isIframe, setIsIframe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rutubeUrlIndex, setRutubeUrlIndex] = useState(0);
  const lastTimeUpdateRef = useRef<number>(0);
  const lastSyncRef = useRef<{isPlaying: boolean, currentTime: number}>({isPlaying: false, currentTime: 0});
  const isUserInteractionRef = useRef<boolean>(false);

  // Проверяем, является ли URL стриминговым сервисом
  const isStreamingService = (url: string) => {
    const streamingDomains = [
      'rezka.ag', 'kinopoisk.ru', 'ivi.ru', 'okko.tv', 'netflix.com',
      'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
      'rutube.ru', 'rutube.com', 'vk.com', 'vk.ru', 'vkvideo.ru',
      'twitch.tv', 'bilibili.com', 'niconico.jp', 'peertube.fr'
    ];
    return streamingDomains.some(domain => url.includes(domain));
  };

  // Преобразуем YouTube URL в embed URL
  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId[1]}?autoplay=0&rel=0&modestbranding=1`;
    }
    return url;
  };

  // Преобразуем Rutube URL в embed URL
  const getRutubeEmbedUrl = async (url: string, urlIndex: number = 0) => {
    const videoId = url.match(/rutube\.ru\/video\/([^\/\n?#]+)/);
    if (videoId) {
      // Сначала пробуем прокси-сервер
      if (urlIndex === 0) {
        try {
          console.log('🔍 Пробуем прокси-сервер для Rutube видео:', videoId[1]);
          const proxyResponse = await fetch(`http://localhost:3006/proxy/rutube/${videoId[1]}`);
          if (proxyResponse.ok) {
            const proxyData = await proxyResponse.json();
            if (proxyData.success && proxyData.embedUrl) {
              console.log('✅ Прокси вернул embed URL:', proxyData.embedUrl);
              return proxyData.embedUrl;
            }
          }
        } catch (error) {
          console.log('❌ Ошибка прокси, пробуем стандартные URL:', error.message);
        }
      }
      
      // Пробуем iframe страницу с прокси
      if (urlIndex === 1) {
        try {
          console.log('🔍 Пробуем iframe страницу через прокси:', videoId[1]);
          return `http://localhost:3006/iframe/${videoId[1]}`;
        } catch (error) {
          console.log('❌ Ошибка iframe страницы:', error.message);
        }
      }
      
      // Пробуем собственный плеер
      if (urlIndex === 2) {
        try {
          console.log('🎬 Пробуем собственный плеер:', videoId[1]);
          return `http://localhost:3006/player/${videoId[1]}`;
        } catch (error) {
          console.log('❌ Ошибка собственного плеера:', error.message);
        }
      }
      
      // Пробуем разные форматы embed URL для Rutube с дополнительными параметрами
      const embedUrls = [
        `https://rutube.ru/play/embed/${videoId[1]}?autoplay=0&rel=0`,
        `https://rutube.ru/embed/${videoId[1]}?autoplay=0&rel=0`,
        `https://rutube.ru/video/embed/${videoId[1]}?autoplay=0&rel=0`,
        `https://rutube.ru/play/embed/${videoId[1]}?autoplay=0&rel=0&allowfullscreen=1`,
        `https://rutube.ru/embed/${videoId[1]}?autoplay=0&rel=0&allowfullscreen=1`,
        `https://rutube.ru/play/embed/${videoId[1]}?autoplay=0&rel=0&allowfullscreen=1&origin=${encodeURIComponent(window.location.origin)}`,
        `https://rutube.ru/embed/${videoId[1]}?autoplay=0&rel=0&allowfullscreen=1&origin=${encodeURIComponent(window.location.origin)}`
      ];
      console.log('🎬 Rutube embed URLs:', embedUrls);
      console.log('🎬 Используем индекс:', urlIndex);
      return embedUrls[urlIndex] || embedUrls[0]; // Возвращаем URL по индексу или первый
    }
    return url;
  };

  // Преобразуем VK URL в embed URL
  const getVKEmbedUrl = (url: string) => {
    console.log('Обрабатываем VK URL:', url);
    
    // Поддерживаемые форматы VK видео
    const patterns = [
      /vk\.com\/video(-?\d+_\d+)/, // video-123_456
      /vk\.com\/clip(-?\d+_\d+)/,  // clip-123_456
      /vk\.com\/video\?z=video(-?\d+_\d+)/, // video?z=video-123_456
      /vk\.com\/clip\?z=clip(-?\d+_\d+)/,   // clip?z=clip-123_456
      /vkvideo\.ru\/video(-?\d+_\d+)/,      // vkvideo.ru/video-123_456
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const videoId = match[1];
        const [ownerId, videoIdNum] = videoId.split('_');
        console.log('Найден VK видео ID:', { ownerId, videoIdNum });
        
        // Для vkvideo.ru используем другой формат
        if (url.includes('vkvideo.ru')) {
          return `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoIdNum}&hd=1`;
        }
        
        return `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoIdNum}&hd=1`;
      }
    }
    
    console.log('VK URL не распознан, возвращаем оригинальный URL');
    return url;
  };

  // Преобразуем Vimeo URL в embed URL
  const getVimeoEmbedUrl = (url: string) => {
    const videoId = url.match(/vimeo\.com\/(\d+)/);
    if (videoId) {
      return `https://player.vimeo.com/video/${videoId[1]}?autoplay=0&title=0&byline=0&portrait=0`;
    }
    return url;
  };

  // Преобразуем Dailymotion URL в embed URL
  const getDailymotionEmbedUrl = (url: string) => {
    const videoId = url.match(/dailymotion\.com\/video\/([^\/\n?#]+)/);
    if (videoId) {
      return `https://www.dailymotion.com/embed/video/${videoId[1]}?autoplay=0`;
    }
    return url;
  };

  // Проверяем, является ли URL прямым видео файлом
  const isDirectVideo = (url: string) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  // Получаем правильный URL для отображения
  const getDisplayUrl = async (url: string) => {
    console.log('Обрабатываем URL:', url);
    
    // Проверяем и исправляем протокол
    let fixedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.startsWith('ttp://')) {
        fixedUrl = 'h' + url;
      } else if (url.startsWith('ttps://')) {
        fixedUrl = 'h' + url;
      } else {
        fixedUrl = 'https://' + url;
      }
      console.log('🔧 Исправлен URL:', fixedUrl);
    }
    
    if (fixedUrl.includes('youtube.com') || fixedUrl.includes('youtu.be')) {
      const embedUrl = getYouTubeEmbedUrl(fixedUrl);
      console.log('YouTube embed URL:', embedUrl);
      return embedUrl;
    }
    if (fixedUrl.includes('rutube.ru') || fixedUrl.includes('rutube.com')) {
      const embedUrl = await getRutubeEmbedUrl(fixedUrl, rutubeUrlIndex);
      console.log('Rutube embed URL:', embedUrl);
      return embedUrl;
    }
    if (fixedUrl.includes('vk.com') || fixedUrl.includes('vk.ru') || fixedUrl.includes('vkvideo.ru')) {
      const embedUrl = getVKEmbedUrl(fixedUrl);
      console.log('VK embed URL:', embedUrl);
      return embedUrl;
    }
    if (fixedUrl.includes('vimeo.com')) {
      const embedUrl = getVimeoEmbedUrl(fixedUrl);
      console.log('Vimeo embed URL:', embedUrl);
      return embedUrl;
    }
    if (fixedUrl.includes('dailymotion.com')) {
      const embedUrl = getDailymotionEmbedUrl(fixedUrl);
      console.log('Dailymotion embed URL:', embedUrl);
      return embedUrl;
    }
    console.log('Используем оригинальный URL:', fixedUrl);
    return fixedUrl;
  };

  useEffect(() => {
    console.log('🎬 Рендер VideoPlayer:', { url, isIframe, displayUrl, isLoading, error });
  }, [url, isIframe, displayUrl, isLoading, error]);

  useEffect(() => {
    if (url) {
      console.log('🎬 VideoPlayer получил новый URL:', url);
      console.log('🎬 Текущее состояние:', { isPlaying, currentTime, duration });
      console.log('🎬 isIframe:', isIframe, 'displayUrl:', displayUrl);
      console.log('🎬 Проверяем тип URL...');
      
      // Сбрасываем индекс Rutube URL при смене URL
      if (url.includes('rutube.ru') || url.includes('rutube.com')) {
        setRutubeUrlIndex(0);
        console.log('🔄 Сброшен индекс Rutube URL');
      }
      
      // Проверяем доступность URL
      if (url.startsWith('http')) {
        console.log('🎬 URL начинается с http - проверяем доступность...');
        fetch(url, { method: 'HEAD', mode: 'no-cors' })
          .then(() => console.log('🎬 URL доступен (HEAD запрос)'))
          .catch(() => console.log('🎬 URL недоступен (HEAD запрос)'));
      }
      
      setError(null);
      setIsLoading(true);
      
      // Таймаут для загрузки видео (15 секунд для iframe, 20 секунд для видео)
      const isStreaming = isStreamingService(url);
      const timeoutDuration = isStreaming ? 15000 : 20000;
      
      const loadingTimeout = setTimeout(() => {
        console.log('⏰ Таймаут загрузки видео');
        setIsLoading(false);
        if (isStreaming) {
          if (url.includes('rutube.ru') || url.includes('rutube.com')) {
            // Не показываем ошибку для Rutube, только кнопки
            setError(null);
          } else {
            setError('Стриминговый сервис не загрузился. Попробуйте другой URL или проверьте доступность сервиса.');
          }
        } else {
          setError('Видео не загрузилось. Проверьте URL и попробуйте снова.');
        }
      }, timeoutDuration);
      
      // Если это прямой видео файл, используем video элемент
      if (isDirectVideo(url)) {
        console.log('🎬 Определен как прямой видео файл');
        setIsIframe(false);
        setDisplayUrl(url);
        console.log('🎬 Установлен displayUrl для видео:', url);
      } else {
        // Иначе используем iframe для стриминговых сервисов
        console.log('🎬 Определен как стриминговый сервис:', isStreaming);
        setIsIframe(isStreaming);
        
        // Асинхронно получаем displayUrl
        getDisplayUrl(url).then(newDisplayUrl => {
          setDisplayUrl(newDisplayUrl);
          console.log('🎬 Установлен displayUrl для iframe:', newDisplayUrl);
        }).catch(error => {
          console.error('❌ Ошибка получения displayUrl:', error);
          setDisplayUrl(url); // Fallback к оригинальному URL
        });
      }
      
      return () => {
        clearTimeout(loadingTimeout);
      };
    } else {
      console.log('🎬 VideoPlayer: URL пустой (ожидание восстановления состояния)');
    }
  }, [url]);

  useEffect(() => {
    if (isIframe) {
      // Для iframe отправляем команды через postMessage
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        try {
          if (isPlaying) {
            // Отправляем команду воспроизведения в iframe
            iframe.contentWindow?.postMessage('play', '*');
          } else {
            // Отправляем команду паузы в iframe
            iframe.contentWindow?.postMessage('pause', '*');
          }
        } catch (error) {
          console.log('Не удалось отправить команду в iframe');
        }
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Проверяем, изменились ли данные синхронизации
    const hasChanges = 
      lastSyncRef.current.isPlaying !== isPlaying ||
      Math.abs(lastSyncRef.current.currentTime - currentTime) > 0.5;

    if (!hasChanges) {
      return; // Нет изменений, пропускаем синхронизацию
    }

    console.log('🎬 Применяем синхронизацию:', { isPlaying, currentTime });
    
    // Обновляем время только если разница больше 0.5 секунд
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      console.log('🎬 Устанавливаем время:', currentTime, 'текущее:', video.currentTime);
      video.currentTime = currentTime;
    }

    // Устанавливаем состояние воспроизведения только если оно изменилось и нет пользовательского взаимодействия
    if (!isUserInteractionRef.current) {
      if (isPlaying && video.paused) {
        console.log('🎬 Запускаем воспроизведение (синхронизация)');
        video.play().catch(console.error);
      } else if (!isPlaying && !video.paused) {
        console.log('🎬 Останавливаем воспроизведение (синхронизация)');
        video.pause();
      }
    } else {
      console.log('🎬 Пропускаем синхронизацию - пользователь взаимодействует');
    }

    // Обновляем последнее состояние синхронизации
    lastSyncRef.current = { isPlaying, currentTime };
  }, [isPlaying, currentTime, isIframe]);

  useEffect(() => {
    if (isIframe) {
      // Для iframe отправляем команду перемотки
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        try {
          iframe.contentWindow?.postMessage(`seek:${currentTime}`, '*');
        } catch (error) {
          console.log('Не удалось отправить команду перемотки в iframe');
        }
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Время обрабатывается в основном useEffect выше
  }, [currentTime, isIframe]);

  useEffect(() => {
    if (isIframe) {
      // Добавляем обработчик сообщений от iframe
      const handleMessage = (event: MessageEvent) => {
        // Проверяем, что сообщение от нашего iframe
        if (event.source === iframeRef.current?.contentWindow) {
          const data = event.data;
          
          if (typeof data === 'object' && data.type) {
            switch (data.type) {
              case 'timeupdate':
                onTimeUpdate(data.currentTime);
                break;
              case 'play':
                onPlayPause(true);
                break;
              case 'pause':
                onPlayPause(false);
                break;
              case 'durationchange':
                onDurationChange(data.duration);
                break;
            }
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isIframe, onTimeUpdate, onPlayPause, onDurationChange]);

  const handleVideoClick = () => {
    console.log('🎬 Клик по видео, текущее состояние:', isPlaying);
    isUserInteractionRef.current = true;
    
    if (isIframe) {
      // Для iframe отправляем команду переключения воспроизведения
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        try {
          iframe.contentWindow?.postMessage(isPlaying ? 'pause' : 'play', '*');
        } catch (error) {
          console.log('Не удалось отправить команду в iframe');
        }
      }
      return;
    }
    
    // Для обычного видео переключаем состояние
    const newPlayingState = !isPlaying;
    console.log('🎬 Переключаем воспроизведение на:', newPlayingState);
    onPlayPause(newPlayingState);
    
    // Сбрасываем флаг пользовательского взаимодействия через 2 секунды
    setTimeout(() => {
      isUserInteractionRef.current = false;
      console.log('🎬 Сброшен флаг пользовательского взаимодействия');
    }, 2000);
  };

  const handleTimeUpdate = () => {
    if (isIframe) {
      // Для iframe время обновляется через postMessage
      return;
    }
    const video = videoRef.current;
    if (video) {
      const now = Date.now();
      // Обновляем время не чаще чем раз в 500мс для уменьшения нагрузки
      if (now - lastTimeUpdateRef.current > 500) {
        // Не отправляем обновления времени во время пользовательского взаимодействия
        if (!isUserInteractionRef.current) {
          onTimeUpdate(video.currentTime);
        }
        lastTimeUpdateRef.current = now;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (isIframe) {
      // Для iframe метаданные загружаются через postMessage
      console.log('🎬 Iframe метаданные загружены');
      setIsLoading(false);
      setError(null);
      return;
    }
    const video = videoRef.current;
    if (video) {
      console.log('🎬 Видео загружено, длительность:', video.duration);
      console.log('🎬 Видео готово к воспроизведению');
      onDurationChange(video.duration);
      setIsLoading(false);
      setError(null);
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('❌ Ошибка загрузки видео:', e);
    console.error('❌ Видео элемент:', videoRef.current);
    
    const video = videoRef.current;
    if (video && video.error) {
      console.error('❌ Код ошибки видео:', video.error.code);
      console.error('❌ Сообщение ошибки:', video.error.message);
      
      let errorMessage = 'Ошибка загрузки видео. ';
      switch (video.error.code) {
        case 1:
          errorMessage += 'Видео заблокировано или недоступно.';
          break;
        case 2:
          errorMessage += 'Сетевая ошибка. Проверьте подключение к интернету.';
          break;
        case 3:
          errorMessage += 'Видео повреждено или имеет неподдерживаемый формат.';
          break;
        case 4:
          errorMessage += 'Видео не может быть воспроизведено.';
          break;
        default:
          errorMessage += 'Проверьте URL и попробуйте снова.';
      }
      setError(errorMessage);
    } else {
      setError('Ошибка загрузки видео. Проверьте URL и попробуйте снова.');
    }
    setIsLoading(false);
  };

  const handleIframeLoad = () => {
    console.log('Iframe загружен');
    setIsLoading(false);
    
    // Проверяем, не заблокирован ли iframe
    setTimeout(() => {
      if (iframeRef.current) {
        try {
          // Попробуем получить доступ к содержимому iframe
          const iframe = iframeRef.current;
          if (iframe.contentWindow && iframe.contentWindow.location.href) {
            console.log('Iframe успешно загружен');
          }
        } catch (error) {
          console.log('Iframe заблокирован политикой безопасности');
          
          // Специальная обработка для Rutube
          if (url.includes('rutube.ru') || url.includes('rutube.com')) {
            setError('Видео заблокировано для встраивания. Попробуйте другие методы.');
          } else {
            setError('Видео заблокировано для встраивания. Попробуйте другой URL.');
          }
        }
      }
    }, 2000);
  };

  const handleIframeError = () => {
    console.log('❌ Ошибка загрузки iframe');
    
    // Для Rutube пробуем следующий embed URL
    if (url.includes('rutube.ru') || url.includes('rutube.com')) {
      if (rutubeUrlIndex < 8) { // У нас 9 вариантов URL (индексы 0-8)
        console.log('🔄 Пробуем следующий Rutube embed URL, индекс:', rutubeUrlIndex + 1);
        setRutubeUrlIndex(rutubeUrlIndex + 1);
        setIsLoading(true);
        setError(null);
        return;
      } else {
        console.log('❌ Все варианты Rutube embed URL исчерпаны');
        setError('Все методы встраивания исчерпаны. Попробуйте открыть видео в новом окне.');
      }
    } else {
      setError('Стриминговый сервис не загрузился. Попробуйте другой URL или проверьте доступность сервиса.');
    }
    
    setIsLoading(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (isIframe) {
      // Для iframe отправляем команду перемотки
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        try {
          iframe.contentWindow?.postMessage(`seek:${time}`, '*');
        } catch (error) {
          console.log('Не удалось отправить команду перемотки в iframe');
        }
      }
      return;
    }
    onSeek(time);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const url = inputUrl.trim();
    console.log('Отправляем новый URL:', url);
    
    // Просто вставляем ссылку
    onUrlChange(url);
    setShowUrlInput(false);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Функции для полноэкранного режима
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Входим в полноэкранный режим
      const videoContainer = document.querySelector('.video-container');
      if (videoContainer) {
        videoContainer.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(err => {
          console.log('Ошибка входа в полноэкранный режим:', err);
        });
      }
    } else {
      // Выходим из полноэкранного режима
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.log('Ошибка выхода из полноэкранного режима:', err);
      });
    }
  };

  // Слушаем изменения полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (showUrlInput) {
    return (
      <div className="video-player">
        <div className="url-input-container">
          <h3>Введите URL видео</h3>
          <form onSubmit={handleUrlSubmit}>
            <input
              type="url"
              placeholder="Вставьте ссылку на видео"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="input"
              required
            />
            <button type="submit" className="btn">
              Загрузить видео
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player">
      <div className="video-container">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Загрузка видео...</p>
          </div>
        )}
        
        {error && !(url.includes('rutube.ru') || url.includes('rutube.com')) && (
          <div className="error-overlay">
            <div className="error-message">
              <p>❌ {error}</p>
              <button 
                onClick={() => setShowUrlInput(true)}
                className="btn"
              >
                🔗 Попробовать другой URL
              </button>
            </div>
          </div>
        )}
        
        {/* Показываем кнопки для Rutube только при ошибке */}
        {error && (url.includes('rutube.ru') || url.includes('rutube.com')) && (
          <div className="error-overlay">
            <div className="error-message">
              <p>❌ {error}</p>
              <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                💡 <strong>Попробуйте разные методы встраивания:</strong>
              </div>
              <button 
                onClick={() => {
                  setRutubeUrlIndex(0);
                  setIsLoading(true);
                  setError(null);
                }}
                className="btn"
                style={{ marginRight: '8px', background: '#ff6b6b' }}
              >
                🔍 Попробовать прокси-сервер
              </button>
              <button 
                onClick={() => {
                  setRutubeUrlIndex(1);
                  setIsLoading(true);
                  setError(null);
                }}
                className="btn"
                style={{ marginRight: '8px', background: '#9c27b0' }}
              >
                🎭 Попробовать iframe страницу
              </button>
              <button 
                onClick={() => {
                  setRutubeUrlIndex(2);
                  setIsLoading(true);
                  setError(null);
                }}
                className="btn"
                style={{ marginRight: '8px', background: '#ff9800' }}
              >
                🎮 Попробовать собственный плеер
              </button>
              <button 
                onClick={() => {
                  if (rutubeUrlIndex < 8) {
                    setRutubeUrlIndex(rutubeUrlIndex + 1);
                    setIsLoading(true);
                    setError(null);
                  }
                }}
                className="btn"
                style={{ marginRight: '8px', background: '#007bff' }}
                disabled={rutubeUrlIndex >= 8}
              >
                🔄 Попробовать другой embed URL ({rutubeUrlIndex + 1}/9)
              </button>
              <button 
                onClick={() => window.open(url, '_blank')}
                className="btn"
                style={{ background: '#28a745' }}
              >
                🎬 Открыть видео в новом окне
              </button>
            </div>
          </div>
        )}
        
        {isIframe ? (
          <iframe
            ref={iframeRef}
            src={displayUrl}
            className="video-element iframe-video"
            allowFullScreen
            allow="autoplay; encrypted-media"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        ) : (
          <video
            ref={videoRef}
            src={displayUrl}
            onClick={handleVideoClick}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => {
              console.log('🎬 Видео готово к воспроизведению (canplay)');
              setIsLoading(false);
              setError(null);
            }}
            onError={handleVideoError}
            onPlay={() => {
              console.log('🎬 Событие play сработало');
              // Не обрабатываем автоматические события play/pause
            }}
            onPause={() => {
              console.log('🎬 Событие pause сработало');
              // Не обрабатываем автоматические события play/pause
            }}
            className="video-element"
            style={{ display: displayUrl ? 'block' : 'none' }}
          />
        )}
        
        {!url && !isLoading && !error && (
          <div className="video-placeholder">
            <p>Нажмите "🔗" чтобы добавить видео</p>
          </div>
        )}
        
        {isLoading && displayUrl && (
          <div className="loading-overlay" style={{ zIndex: 10 }}>
            <div className="loading-spinner"></div>
            <p>Загрузка видео...</p>
            <p style={{fontSize: '0.8rem', marginTop: '8px'}}>URL: {displayUrl}</p>
          </div>
        )}
      </div>

      <div className="video-controls">
        <div className="control-row">
          <button
            onClick={() => {
              console.log('🎬 Клик по кнопке паузы/воспроизведения');
              isUserInteractionRef.current = true;
              const newPlayingState = !isPlaying;
              console.log('🎬 Переключаем на:', newPlayingState);
              onPlayPause(newPlayingState);
              
              // Сбрасываем флаг через 2 секунды
              setTimeout(() => {
                isUserInteractionRef.current = false;
                console.log('🎬 Сброшен флаг пользовательского взаимодействия (кнопка)');
              }, 2000);
            }}
            className="control-btn"
            disabled={!url || isLoading}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          
          {isIframe && (
            <div className="iframe-notice">
              📺 Стриминговый сервис - синхронизация ограничена
            </div>
          )}
          
          <button
            onClick={toggleFullscreen}
            className="control-btn"
            title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
          >
            {isFullscreen ? '⏹️' : '⛶'}
          </button>
          
          <button
            onClick={() => setShowUrlInput(true)}
            className="control-btn"
          >
            🔗
          </button>
        </div>
        
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="seek-bar"
          disabled={!url || isLoading}
        />
      </div>
    </div>
  );
};

export default VideoPlayer; 