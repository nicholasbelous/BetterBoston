import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Loading from './pages/Loading';
import ReportPage from './pages/Report';
import HeatDetail from './pages/HeatDetail';
import OutOfCoverage from './pages/OutOfCoverage';
import About from './pages/About';

// Scroll to #anchors (like /#how or /report/x#plan), otherwise to the top on each new page.
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/report/:blockId" element={<ReportPage />} />
        <Route path="/report/:blockId/heat" element={<HeatDetail />} />
        <Route path="/out-of-coverage" element={<OutOfCoverage />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
