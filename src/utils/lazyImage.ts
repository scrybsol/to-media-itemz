export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

export const getOptimizedImageUrl = (url: string, width?: number): string => {
  if (!url) return '';

  if (url.includes('pexels.com')) {
    if (width) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}w=${width}&q=75`;
    }
    return url;
  }

  return url;
};

export const createImageSet = (url: string): string => {
  const mobile = getOptimizedImageUrl(url, 400);
  const tablet = getOptimizedImageUrl(url, 600);
  const desktop = getOptimizedImageUrl(url, 800);

  return `${mobile} 400w, ${tablet} 600w, ${desktop} 800w`;
};
