import { useState } from 'react';

interface PhotoImageProps {
  photoId: number;
  filePath: string;
  fileName: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

// Generate URL patterns to try for loading images
// Uses Vercel proxy to avoid CORS issues
function getImageUrls(filePath: string): string[] {
  // Clean up file path
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  
  return [
    // 1. Through Vercel proxy (most reliable)
    `/${cleanPath}`,
    // 2. Without app/ prefix
    `/${cleanPath.replace('app/', '')}`,
    // 3. Just static path
    `/static/${cleanPath.split('/').pop()}`,
  ];
}

export default function PhotoImage({ 
  photoId, 
  filePath, 
  fileName, 
  alt = '', 
  className = '',
  onClick 
}: PhotoImageProps) {
  const urls = getImageUrls(filePath);
  const [urlIndex, setUrlIndex] = useState(0);
  const [error, setError] = useState(false);

  console.log(`🖼️ PhotoImage ${photoId}: trying URL ${urlIndex + 1}/${urls.length}:`, urls[urlIndex]);

  const handleError = () => {
    console.log(`  ❌ URL failed: ${urls[urlIndex]}`);
    
    if (urlIndex < urls.length - 1) {
      // Try next URL
      setUrlIndex(urlIndex + 1);
    } else {
      // All URLs failed
      console.log(`  ❌ All URLs failed for photo ${photoId}`);
      setError(true);
    }
  };

  const handleLoad = () => {
    console.log(`  ✅ Image loaded: ${urls[urlIndex]}`);
  };

  if (error) {
    return (
      <div className={`photo-error ${className}`} onClick={onClick}>
        <div className="error-icon">🖼️</div>
        <span className="error-filename">{fileName}</span>
      </div>
    );
  }

  return (
    <img 
      src={urls[urlIndex]} 
      alt={alt || fileName}
      className={className}
      onClick={onClick}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

