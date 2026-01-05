import { useState, useEffect } from 'react';
import { tokenManager } from '../api/client';

interface PhotoImageProps {
  photoId: number;
  filePath: string;
  fileName: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

// Cache for photo blob URLs to avoid refetching
const photoCache: { [key: string]: string } = {};

export default function PhotoImage({ 
  photoId, 
  filePath, 
  fileName, 
  alt = '', 
  className = '',
  onClick 
}: PhotoImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPhoto = async () => {
      const cacheKey = `photo_${photoId}`;
      
      // Check cache first
      if (photoCache[cacheKey]) {
        console.log(`🖼️ Using cached URL for photo ${photoId}`);
        setImageUrl(photoCache[cacheKey]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      console.log(`🖼️ Loading photo ${photoId}:`, { fileName, filePath });

      // Strategy 1: Fetch via API with authentication (most reliable)
      // This endpoint should return the actual image data
      try {
        const token = tokenManager.getToken();
        console.log(`  1️⃣ Trying authenticated API fetch: /api/photos/${photoId}`);
        
        const response = await fetch(`/api/photos/${photoId}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          console.log(`  Response content-type:`, contentType);
          
          if (contentType?.startsWith('image/')) {
            // Direct image response - create blob URL
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            console.log(`  ✅ Got image blob, size: ${blob.size}`);
            photoCache[cacheKey] = blobUrl;
            setImageUrl(blobUrl);
            setLoading(false);
            return;
          } else {
            // JSON response - might contain file URL or base64 data
            const data = await response.json();
            console.log(`  API returned JSON:`, data);
            
            // Try to extract image data from response
            if (data.base64 || data.data) {
              const base64Data = data.base64 || data.data;
              const dataUrl = base64Data.startsWith('data:') 
                ? base64Data 
                : `data:image/jpeg;base64,${base64Data}`;
              console.log(`  ✅ Got base64 data`);
              photoCache[cacheKey] = dataUrl;
              setImageUrl(dataUrl);
              setLoading(false);
              return;
            }
            
            // Try URL from response
            if (data.url || data.file_url || data.file_path) {
              const responseUrl = data.url || data.file_url || data.file_path;
              const fullUrl = responseUrl.startsWith('http') 
                ? responseUrl 
                : `https://thistimeapp.com/${responseUrl}`;
              console.log(`  Got URL from API, trying:`, fullUrl);
              
              // Fetch the image from this URL
              const imgResponse = await fetch(fullUrl);
              if (imgResponse.ok) {
                const imgBlob = await imgResponse.blob();
                const blobUrl = URL.createObjectURL(imgBlob);
                console.log(`  ✅ Got image from URL`);
                photoCache[cacheKey] = blobUrl;
                setImageUrl(blobUrl);
                setLoading(false);
                return;
              }
            }
          }
        } else {
          console.log(`  API returned ${response.status}: ${response.statusText}`);
        }
      } catch (e) {
        console.log(`  API fetch error:`, e);
      }

      // Strategy 2: Try static file URL patterns through Vercel proxy
      const staticUrls = [
        `/${filePath}`,
        `/${filePath.replace('app/', '')}`,
        `/static/${filePath.split('/').pop()}`,
      ];

      for (const url of staticUrls) {
        try {
          console.log(`  2️⃣ Trying static URL:`, url);
          const response = await fetch(url);
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType?.startsWith('image/')) {
              const blob = await response.blob();
              const blobUrl = URL.createObjectURL(blob);
              console.log(`  ✅ Got image from static URL`);
              photoCache[cacheKey] = blobUrl;
              setImageUrl(blobUrl);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          // Continue to next URL
        }
      }

      // Strategy 3: Try direct backend URL (might have CORS issues)
      try {
        const directUrl = `https://thistimeapp.com/${filePath}`;
        console.log(`  3️⃣ Trying direct backend URL:`, directUrl);
        const response = await fetch(directUrl);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          console.log(`  ✅ Got image from direct URL`);
          photoCache[cacheKey] = blobUrl;
          setImageUrl(blobUrl);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.log(`  Direct URL failed:`, e);
      }

      // Everything failed
      console.log(`  ❌ All attempts failed for photo ${photoId}`);
      setError(true);
      setLoading(false);
    };

    loadPhoto();
  }, [photoId, filePath, fileName]);

  if (loading) {
    return (
      <div className={`photo-loading ${className}`} onClick={onClick}>
        <div className="loading-spinner">⏳</div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`photo-error ${className}`} onClick={onClick}>
        <div className="error-icon">🖼️</div>
        <span className="error-filename">{fileName}</span>
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={alt || fileName}
      className={className}
      onClick={onClick}
      onError={() => {
        // If the cached URL stops working, clear cache and show error
        console.error(`Image failed to render: ${imageUrl}`);
        delete photoCache[`photo_${photoId}`];
        setError(true);
      }}
    />
  );
}

