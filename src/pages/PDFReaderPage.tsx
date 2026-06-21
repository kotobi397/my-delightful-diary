import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import UniversalFileViewer from '@/components/reading/UniversalFileViewer';
import Navbar from '@/components/layout/Navbar';
import { SEOHead } from '@/components/seo/SEOHead';
import { useBookDetails } from '@/hooks/useBookDetails';

const PDFReaderPage = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { id } = useParams<{ id: string }>();
  const { book } = useBookDetails(id || '');

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const title = book
    ? `قراءة وتحميل ${book.title} PDF | ${book.author}`
    : 'قارئ الكتب - منصة كتبي';
  const description = book
    ? `اقرأ وحمّل ${book.title} للمؤلف ${book.author} مجاناً بصيغة PDF على منصة كتبي.`
    : 'اقرأ الكتب العربية مباشرة عبر متصفحك على منصة كتبي. قارئ مدمج يدعم ملفات PDF والمزيد.';

  return (
    <div>
      <SEOHead title={title} description={description} noindex={true} />
      {!isFullscreen && <Navbar />}
      <UniversalFileViewer />
    </div>
  );
};

export default PDFReaderPage;
