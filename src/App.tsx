/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef, FormEvent } from 'react';
import { 
  Search, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Loader2, 
  ShoppingBag,
  MapPin,
  Phone,
  User,
  Palette,
  Maximize2,
  Hash,
  Tag,
  ShieldCheck,
  Truck,
  Shield,
  Info,
  Star,
  Box,
  Zap,
  Lock,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Share2,
  Heart,
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import Fuse from 'fuse.js';
import { Product, City } from './types';

const BANNER_IMAGE = 'https://www.dropbox.com/scl/fi/n4gjdcsm3ea1mepqtp6ob/7ASAN-BANNER.png?rlkey=8y37c3nifreh23nxux3qiy7om&st=8kodfian&dl=1';
const LOGO_DARK = 'https://www.dropbox.com/scl/fi/lqdxrb7k3g46ca8utmp12/logo-darkmode.png?rlkey=xfciu2laribs5ml7adbkbqvkj&st=agf3abfy&dl=1';
const LOGO_LIGHT = 'https://www.dropbox.com/scl/fi/lqdxrb7k3g46ca8utmp12/logo-darkmode.png?rlkey=xfciu2laribs5ml7adbkbqvkj&st=agf3abfy&dl=1'; // Using same for now, will apply filter
const ITEMS_PER_PAGE = 20;

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const fuseRef = useRef<any>(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [expandedBox, setExpandedBox] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  const cityFuseRef = useRef<any>(null);
  const lastInteractionTime = useRef<number>(Date.now());

  // Update city fuse when cities change
  useEffect(() => {
    if (cities.length > 0) {
      cityFuseRef.current = new Fuse(cities, {
        keys: ['name'],
        threshold: 0.3, // More precise fuzzy matching
        distance: 100,
        ignoreLocation: true, // Find matches anywhere in the string
        minMatchCharLength: 2
      });
    }
  }, [cities]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-swipe for product images
  useEffect(() => {
    if (viewingProduct && viewingProduct.images.length > 1) {
      const timer = setInterval(() => {
        const now = Date.now();
        // Only auto-swipe if 10 seconds have passed since last interaction
        if (now - lastInteractionTime.current >= 10000) {
          setCurrentImageIndex((prev) => (prev + 1) % viewingProduct.images.length);
        }
      }, 5000); // 5 seconds transition
      return () => clearInterval(timer);
    }
  }, [viewingProduct]);

  const handleInteraction = () => {
    lastInteractionTime.current = Date.now();
  };

  // Debounce search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setDebouncedSearchQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (fuseRef.current) {
        const results = fuseRef.current.search(searchQuery);
        setSuggestions(results.map((r: any) => r.item).slice(0, 5));
      }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Products via Server API
        const prodResponse = await fetch('/api/products');
        const prodCsvText = await prodResponse.text();
        
        Papa.parse(prodCsvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as string[][];
            if (rows.length < 5) {
              setProducts([]);
              return;
            }
            const headers = rows[3];
            const dataRows = rows.slice(4);
            const parsedProducts: Product[] = dataRows.map((row) => {
              const product: any = {};
              headers.forEach((header, index) => {
                if (header.startsWith('IMG')) {
                  if (!product.images) product.images = [];
                  if (row[index]) product.images.push(row[index]);
                } else {
                  product[header] = row[index];
                }
              });
              return product as Product;
            });
            const publishedProducts = parsedProducts.filter(p => p.status === 'PUBLISH');
            setProducts(publishedProducts);
            fuseRef.current = new Fuse(publishedProducts, {
              keys: ['title', 'w_code', 'category', 'description'],
              threshold: 0.4,
              distance: 100,
            });
          }
        });

        // Fetch Cities via Server API
        const citiesResponse = await fetch('/api/cities');
        const citiesCsvText = await citiesResponse.text();
        
        Papa.parse(citiesCsvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as string[][];
            if (rows.length < 5) return;
            const dataRows = rows.slice(4);
            const cityMap = new Map<string, City>();
            
            dataRows.forEach(row => {
              if (row[2] && row[3]) {
                const name = row[2].trim();
                const price = parseFloat(row[3]) || 0;
                // Only add if not already present to avoid duplicates
                if (!cityMap.has(name)) {
                  cityMap.set(name, { name, price });
                }
              }
            });
            
            setCities(Array.from(cityMap.values()));
          }
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const citySuggestions = useMemo(() => {
    if (!citySearch.trim()) return [];
    if (cityFuseRef.current) {
      const results = cityFuseRef.current.search(citySearch);
      return results.map((r: any) => r.item).slice(0, 5);
    }
    return cities.filter(c => c.name.includes(citySearch)).slice(0, 5);
  }, [cities, citySearch]);

  const deliveryPrice = useMemo(() => {
    if (!selectedCity) return 0;
    const price = selectedCity.price - 20;
    return price > 0 ? price : 0;
  }, [selectedCity]);

  const productPrice = useMemo(() => {
    if (!viewingProduct) return 0;
    return parseFloat(viewingProduct.sell_price.replace(/[^\d.]/g, '')) || 0;
  }, [viewingProduct]);

  const totalPrice = (productPrice * orderQuantity) + deliveryPrice;

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['الكل', ...Array.from(cats)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        p.w_code.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, debouncedSearchQuery, selectedCategory]);

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedCategory]);

  // Handle URL parameters for deep linking
  useEffect(() => {
    if (loading || products.length === 0) return;

    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get('product');

      if (productId) {
        const product = products.find(p => p.w_code === productId);
        if (product) {
          setViewingProduct(product);
          setCurrentImageIndex(0);
          setExpandedBox(null);
        }
      } else {
        setViewingProduct(null);
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [loading, products]);

  // Update URL when product changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (viewingProduct) {
      params.set('product', viewingProduct.w_code);
    } else {
      params.delete('product');
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    if (window.location.search !== (params.toString() ? '?' + params.toString() : '')) {
      window.history.pushState({}, '', newUrl);
    }
  }, [viewingProduct]);

  const openProductPage = (product: Product) => {
    setViewingProduct(product);
    setCurrentImageIndex(0);
    setExpandedBox(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeProductPage = () => {
    setViewingProduct(null);
    setIsOrderFormOpen(false);
  };

  const openOrderForm = () => {
    if (viewingProduct?.stock_status === 'OUT OF STOCK') return;
    setIsOrderFormOpen(true);
    setIsSuccess(false);
    setIsSubmitting(false);
  };

  const closeOrderForm = () => {
    setIsOrderFormOpen(false);
  };

  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const data = {
      w_code: viewingProduct?.w_code,
      title: viewingProduct?.title,
      sell_price: viewingProduct?.sell_price,
      quantity: orderQuantity,
      name: customerName,
      phone: customerPhone,
      city: selectedCity?.name || citySearch,
      address: customerAddress,
      color: selectedColor,
      size: selectedSize,
      productId: viewingProduct?.w_code
    };

    console.log('Submitting order data:', data);

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setSubmitError(result.error || 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onIframeLoad = () => {
    if (isSubmitting) {
      setIsSubmitting(false);
      setIsSuccess(true);
    }
  };

  const toggleBox = (boxId: string) => {
    setExpandedBox(expandedBox === boxId ? null : boxId);
  };

  const relatedProducts = useMemo(() => {
    if (!viewingProduct) return [];
    return products
      .filter(p => p.w_code !== viewingProduct.w_code && p.category === viewingProduct.category)
      .slice(0, 4);
  }, [products, viewingProduct]);

  const contentBoxes = [
    { id: 'desc', title: 'الوصف', icon: Info, content: viewingProduct?.description },
    { id: 'feat', title: 'المميزات', icon: Zap, content: viewingProduct?.features || 'مميزات مذهلة بانتظارك.' },
    { id: 'box', title: 'في العلبة', icon: Box, content: viewingProduct?.box_contents || 'كل ما تحتاجه في علبة واحدة.' },
    { id: 'use', title: 'الاستخدام', icon: Shield, content: viewingProduct?.how_to_use || 'سهل الاستخدام وبسيط جداً.' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-[100dvh] text-brand-text selection:bg-brand-primary selection:text-white overflow-x-hidden relative select-none">
      {/* Global Background Image & Base Color */}
      <div className="fixed inset-0 z-[-1] bg-brand-bg" />
      <div 
        className="fixed inset-0 z-[-1] pointer-events-none bg-no-repeat bg-center bg-fixed bg-cover opacity-[0.05] grayscale"
        style={{ backgroundImage: `url(${BANNER_IMAGE})` }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Fixed Header Container */}
      <div className="fixed top-0 left-0 right-0 z-40">
        {/* Promotional Top Bar */}
        <div className="bg-brand-primary py-1.5 px-4 text-center overflow-hidden relative">
          <motion.p 
            initial={{ x: '100%' }}
            animate={{ x: '-100%' }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap"
          >
            🔥 عرض خاص: توصيل مجاني في الدار البيضاء وخصومات تصل إلى 50% لفترة محدودة 🔥
          </motion.p>
        </div>

        {/* Header */}
        <header className="bg-brand-bg/90 backdrop-blur-xl border-b border-brand-border">
          <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center relative">
            <div className="flex items-center justify-between w-full">
              {viewingProduct ? (
                <button 
                  onClick={closeProductPage}
                  aria-label="العودة إلى القائمة"
                  className="flex items-center gap-2 text-brand-text-muted hover:text-brand-text transition-colors group z-10"
                >
                  <ChevronRight className="h-5 w-5 group-hover:text-brand-primary transition-colors" />
                  <span className="text-xs font-black uppercase tracking-tight">العودة</span>
                </button>
              ) : (
                <div className="w-10" /> /* Spacer for alignment */
              )}

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300">
                <img 
                  src={LOGO_DARK} 
                  alt="7ASAN STORE" 
                  className={`h-6 sm:h-8 w-auto object-contain transition-all duration-300 ${isSearchExpanded ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}
                  referrerPolicy="no-referrer"
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 transition-all duration-300 ${isSearchExpanded ? 'flex-1' : 'w-20'}`}>
                {viewingProduct ? (
                  <div className="w-10" /> /* Spacer for balance */
                ) : (
                  <div className={`flex items-center transition-all duration-300 ${isSearchExpanded ? 'w-full' : 'w-10'}`}>
                    <div className={`relative flex items-center transition-all duration-300 ${isSearchExpanded ? 'w-full' : 'w-0 overflow-hidden'}`}>
                    <Search className="absolute right-3 text-gray-500 h-3.5 w-3.5" />
                    <input
                      type="text"
                      placeholder="ابحث..."
                      autoFocus={isSearchExpanded}
                      className="w-full bg-brand-card/50 border border-brand-border rounded-xl py-1.5 pr-9 pl-8 focus:outline-none focus:border-brand-primary/50 transition-all text-xs placeholder:text-gray-600"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => {
                        // Small delay to allow clicking suggestions
                        setTimeout(() => {
                          if (!searchQuery) setIsSearchExpanded(false);
                          setSuggestions([]);
                        }, 200);
                      }}
                    />
                    
                    {/* Search Suggestions Dropdown */}
                    <AnimatePresence>
                      {suggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-2xl z-[60] backdrop-blur-xl"
                        >
                          {suggestions.map((product) => (
                            <button
                              key={product.w_code}
                              onClick={() => {
                                openProductPage(product);
                                setSearchQuery('');
                                setSuggestions([]);
                                setIsSearchExpanded(false);
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-brand-text/5 transition-colors border-b border-brand-border last:border-0 text-right"
                            >
                              <img 
                                src={product.images[0]} 
                                alt="" 
                                className="w-10 h-10 rounded-lg object-cover"
                                referrerPolicy="no-referrer"
                                onContextMenu={(e) => e.preventDefault()}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-brand-text truncate">{product.title}</div>
                                <div className="text-[10px] text-brand-primary font-black">{product.sell_price} درهم</div>
                              </div>
                              <ChevronLeft className="h-3 w-3 text-gray-600" />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button 
                      onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); }}
                      className="absolute left-2 text-gray-500 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  
                  {!isSearchExpanded && (
                    <button 
                      onClick={() => setIsSearchExpanded(true)}
                      className="p-2 text-brand-text-muted hover:text-brand-primary transition-colors"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-2 sm:py-4 pt-24 sm:pt-28">
        <AnimatePresence mode="wait">
          {!viewingProduct ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Hero Section */}
              <div className="mb-8 py-10 sm:py-14 text-center relative overflow-hidden rounded-[2.5rem] bg-atmospheric border border-brand-border/30">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="relative z-10 px-6 flex flex-col items-center"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
                    className="relative"
                  >
                    <h1 className="text-4xl sm:text-6xl md:text-7xl font-black mb-4 leading-[1] tracking-tighter text-brand-text uppercase italic">
                      مرحباً بكم في <br />
                      <span className="text-brand-primary drop-shadow-[0_0_20px_rgba(139,92,246,0.4)]">متجر حسن</span>
                    </h1>
                  </motion.div>

                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="text-brand-text-muted text-xs sm:text-base max-w-xl mx-auto leading-relaxed font-medium mb-8"
                  >
                    اكتشف أحدث المنتجات الإلكترونية والذكية بجودة عالية وأفضل الأسعار في المغرب.
                  </motion.p>

                  {/* Static Squared Badges */}
                  <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                    {[
                      { icon: Truck, label: 'توصيل سريع' },
                      { icon: ShieldCheck, label: 'دفع آمن' },
                      { icon: Star, label: 'جودة عالية' },
                      { icon: Zap, label: 'أفضل سعر' },
                    ].map((feature, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + (i * 0.05) }}
                        className="glass-card w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex flex-col items-center justify-center gap-1 border border-white/5 shadow-lg"
                      >
                        <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-brand-primary" />
                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tighter text-brand-text/80 text-center px-1">{feature.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
                
                {/* Immersive Background Elements */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-1/4 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px]" />
                  <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px]" />
                </div>
              </div>

              {/* Categories Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold flex items-center gap-3">
                    <div className="w-1 h-5 bg-brand-primary rounded-full" />
                    تصفح حسب الفئة
                  </h2>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 group ${
                        selectedCategory === cat 
                          ? 'bg-brand-primary border-brand-primary shadow-lg shadow-brand-primary/20' 
                          : 'bg-brand-card border-brand-border hover:border-brand-primary/50'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg mb-1 transition-colors ${
                        selectedCategory === cat ? 'bg-brand-text/20' : 'bg-brand-text/5 group-hover:bg-brand-primary/10'
                      }`}>
                        <Tag className={`h-3 w-3 ${selectedCategory === cat ? 'text-white' : 'text-brand-primary'}`} />
                      </div>
                      <span className={`text-[8px] font-bold text-center ${selectedCategory === cat ? 'text-white' : 'text-brand-text-muted'}`}>
                        {cat}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-3">
                  <div className="w-1 h-5 bg-brand-primary rounded-full" />
                  منتجات مختارة
                </h2>
                <span className="text-[10px] text-brand-text-muted font-bold uppercase tracking-widest">
                  {filteredProducts.length} منتج
                </span>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden animate-pulse">
                      <div className="aspect-square bg-brand-text/5" />
                      <div className="p-4 space-y-3">
                        <div className="h-2 w-12 bg-brand-text/5 rounded" />
                        <div className="h-4 w-full bg-brand-text/5 rounded" />
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-16 bg-brand-text/5 rounded" />
                          <div className="h-8 w-8 bg-brand-text/5 rounded-xl" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
                  >
                    {paginatedProducts.map((product, index) => (
                      <motion.div
                        layout
                        variants={itemVariants}
                        key={`${product.w_code}-${index}`}
                        onClick={() => openProductPage(product)}
                        className="group bg-brand-card border border-brand-border rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all duration-200"
                      >
                        <div className="aspect-square relative overflow-hidden">
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onContextMenu={(e) => e.preventDefault()}
                          />
                          {products.indexOf(product) < 2 && (
                            <div className="absolute top-3 left-3 bg-brand-primary text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg shadow-brand-primary/40 animate-pulse">
                              الأكثر مبيعاً
                            </div>
                          )}
                          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg border border-white/10">
                            #{product.w_code}
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="text-brand-primary text-[10px] font-black uppercase tracking-widest mb-1.5">
                            {product.category}
                          </div>
                          <h3 className="text-sm font-bold line-clamp-2 mb-3 h-10 leading-snug text-brand-text">
                            {product.title}
                          </h3>
                          <div className="flex items-center justify-between">
                            <span className="text-brand-primary font-black text-base">{product.sell_price} درهم</span>
                            <div className="bg-brand-primary text-white p-2 rounded-xl shadow-lg shadow-brand-primary/30">
                              <ChevronLeft className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-12 flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setCurrentPage(prev => Math.max(1, prev - 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl bg-brand-card border border-brand-border text-brand-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-brand-primary transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>

                      <div className="flex items-center gap-1">
                        {[...Array(totalPages)].map((_, i) => {
                          const pageNum = i + 1;
                          // Show first, last, and pages around current
                          if (
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={pageNum}
                                onClick={() => {
                                  setCurrentPage(pageNum);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`w-10 h-10 rounded-xl font-bold text-xs transition-all ${
                                  currentPage === pageNum
                                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                                    : 'bg-brand-card border border-brand-border text-brand-text-muted hover:border-brand-primary'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                          if (
                            pageNum === currentPage - 2 ||
                            pageNum === currentPage + 2
                          ) {
                            return <span key={pageNum} className="text-gray-600">...</span>;
                          }
                          return null;
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setCurrentPage(prev => Math.min(totalPages, prev + 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl bg-brand-card border border-brand-border text-brand-text-muted disabled:opacity-30 disabled:cursor-not-allowed hover:border-brand-primary transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    </div>
                  )}

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-20">
                      <p className="text-brand-text-muted">لم يتم العثور على منتجات تطابق بحثك.</p>
                    </div>
                  )}

                  {/* Testimonials Section */}
                  <div className="mt-10 border-t border-brand-border pt-10">
                    <div className="text-center mb-8">
                      <h2 className="text-xl font-bold mb-1">ماذا يقول عملاؤنا؟</h2>
                      <p className="text-brand-text-muted text-[10px]">ثقة أكثر من +1000 عميل في جميع أنحاء المغرب</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { name: 'أمين ب.', city: 'الدار البيضاء', text: 'جودة المنتجات رائعة جداً والتوصيل كان في أقل من 24 ساعة. شكراً متجر حسن!' },
                        { name: 'سارة م.', city: 'مراكش', text: 'أعجبتني فكرة الدفع عند الاستلام، والمنتج وصل تماماً كما في الصور.' },
                        { name: 'ياسين ر.', city: 'طنجة', text: 'خدمة عملاء ممتازة وسرعة في الرد. أنصح الجميع بالتعامل معهم.' }
                      ].map((t, i) => (
                        <div key={i} className="bg-brand-card border border-brand-border rounded-3xl p-6 relative">
                          <div className="flex text-brand-primary mb-4">
                            {[...Array(5)].map((_, j) => <Star key={j} className="h-3 w-3 fill-current" />)}
                          </div>
                          <p className="text-sm text-brand-text-muted leading-relaxed mb-6 italic">"{t.text}"</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold">
                              {t.name[0]}
                            </div>
                            <div>
                              <div className="text-xs font-bold">{t.name}</div>
                              <div className="text-[10px] text-brand-text-muted">{t.city}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="product-page"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 pb-24"
            >
              {/* Product Page Content - Compact */}
              <div className="flex flex-col md:flex-row gap-6">
                {/* Image Section */}
                <div className="w-full md:w-1/2">
                  <div className="bg-brand-card rounded-3xl overflow-hidden aspect-square relative flex items-center justify-center border border-brand-border">
                    {/* Logo Watermark */}
                    <img 
                      src={LOGO_DARK} 
                      alt="Watermark" 
                      className="absolute top-6 right-6 h-6 sm:h-8 w-auto opacity-15 pointer-events-none z-20 select-none grayscale brightness-200"
                      referrerPolicy="no-referrer"
                    />
                    
                    <AnimatePresence mode="wait">
                      <motion.img 
                        key={currentImageIndex}
                        src={viewingProduct.images[currentImageIndex]} 
                        alt={viewingProduct.title}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        onDragStart={() => {
                          handleInteraction();
                          setIsDragging(true);
                        }}
                        onDragEnd={(_, info) => {
                          handleInteraction();
                          if (info.offset.x > 50) {
                            setCurrentImageIndex((prev) => (prev - 1 + viewingProduct.images.length) % viewingProduct.images.length);
                          } else if (info.offset.x < -50) {
                            setCurrentImageIndex((prev) => (prev + 1) % viewingProduct.images.length);
                          }
                          // Use a small timeout to reset isDragging so onClick doesn't fire immediately
                          setTimeout(() => setIsDragging(false), 100);
                        }}
                        className="w-full h-full object-cover absolute inset-0 cursor-grab active:cursor-grabbing"
                        referrerPolicy="no-referrer"
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => {
                          if (!isDragging) {
                            setIsImageModalOpen(true);
                          }
                        }}
                      />
                    </AnimatePresence>
                    
                    {viewingProduct.images.length > 1 && (
                      /* Carousel Dots */
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        {viewingProduct.images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-brand-primary w-4' : 'bg-white/30'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Section */}
                <div className="w-full md:w-1/2 flex flex-col">
                  <div className="flex items-center gap-2 text-brand-primary text-[10px] font-black mb-2">
                    <span className="bg-brand-primary/10 px-3 py-1 rounded-full">#{viewingProduct.w_code}</span>
                    <span className="bg-brand-text/5 px-3 py-1 rounded-full text-brand-text-muted">{viewingProduct.category}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h1 className="text-2xl font-bold leading-tight text-brand-text">{viewingProduct.title}</h1>
                    <button 
                      onClick={async () => {
                        const shareData = {
                          title: viewingProduct.title,
                          text: viewingProduct.description,
                          url: window.location.href,
                        };
                        try {
                          if (navigator.share) {
                            await navigator.share(shareData);
                          } else {
                            await navigator.clipboard.writeText(window.location.href);
                            setIsSharing(true);
                            setTimeout(() => setIsSharing(false), 2000);
                          }
                        } catch (err) {
                          console.error('Error sharing:', err);
                        }
                      }}
                      className="p-3 bg-brand-text/5 hover:bg-brand-primary rounded-2xl transition-all group relative"
                    >
                      <Share2 className="h-5 w-5 text-brand-text-muted group-hover:text-brand-text" />
                      {isSharing && (
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                          تم نسخ الرابط!
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="flex items-end gap-3 mb-4">
                    <div className="text-3xl font-black text-brand-primary">{viewingProduct.sell_price} درهم</div>
                    <div className="text-sm text-brand-text-muted line-through mb-1 opacity-50">
                      {parseInt(viewingProduct.sell_price) + 100} درهم
                    </div>
                  </div>

                  {/* Urgency & Delivery Info */}
                  <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-2xl p-4 mb-6 space-y-3">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${viewingProduct.stock_status === 'OUT OF STOCK' ? 'bg-gray-500' : 'bg-brand-primary'} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${viewingProduct.stock_status === 'OUT OF STOCK' ? 'bg-gray-500' : 'bg-brand-primary'}`}></span>
                      </div>
                      <span className={`font-bold ${viewingProduct.stock_status === 'OUT OF STOCK' ? 'text-brand-text-muted' : 'text-brand-primary'}`}>
                        {viewingProduct.stock_status === 'OUT OF STOCK' ? 'نفذت الكمية' : 'متوفر في المخزون'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-text-muted">
                      <Truck className="h-4 w-4 text-brand-primary" />
                      <span>توصيل مجاني فقط في <span className="text-brand-text font-bold">الدار البيضاء</span></span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-text-muted">
                      <ShieldCheck className="h-4 w-4 text-brand-primary" />
                      <span>الدفع عند الاستلام <span className="text-brand-text font-bold">كاش</span></span>
                    </div>
                  </div>
                  
                  {/* Content Boxes Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {contentBoxes.map((box) => (
                      <div key={box.id} className="flex flex-col">
                        <button
                          onClick={() => toggleBox(box.id)}
                          aria-expanded={expandedBox === box.id}
                          aria-controls={`box-content-${box.id}`}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 ${
                            expandedBox === box.id 
                              ? 'bg-brand-primary border-brand-primary shadow-lg shadow-brand-primary/20' 
                              : 'bg-brand-card border-brand-border hover:border-brand-primary/50'
                          }`}
                        >
                          <box.icon className={`h-5 w-5 mb-1 ${expandedBox === box.id ? 'text-white' : 'text-brand-primary'}`} />
                          <span className="text-[10px] font-bold">{box.title}</span>
                          <ChevronDown className={`h-3 w-3 mt-1 transition-transform duration-300 ${expandedBox === box.id ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Expanded Box Content */}
                  <AnimatePresence mode="wait">
                    {expandedBox && (
                      <motion.div
                        key={expandedBox}
                        id={`box-content-${expandedBox}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-6"
                      >
                        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 text-sm text-brand-text leading-relaxed whitespace-pre-line">
                          {contentBoxes.find(b => b.id === expandedBox)?.content}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-auto hidden md:block">
                    <button 
                      onClick={openOrderForm}
                      disabled={viewingProduct.stock_status === 'OUT OF STOCK'}
                      className={`w-full ${viewingProduct.stock_status === 'OUT OF STOCK' ? 'bg-gray-800 cursor-not-allowed' : 'animate-color-shift'} text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-lg`}
                    >
                      <ShoppingBag className="h-6 w-6" />
                      {viewingProduct.stock_status === 'OUT OF STOCK' ? 'نفذت الكمية' : 'اطلب الآن - الدفع عند الاستلام'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Sticky CTA */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-brand-bg/80 backdrop-blur-xl border-t border-brand-border md:hidden z-30">
                <button 
                  onClick={openOrderForm}
                  disabled={viewingProduct.stock_status === 'OUT OF STOCK'}
                  className={`w-full ${viewingProduct.stock_status === 'OUT OF STOCK' ? 'bg-gray-800 cursor-not-allowed' : 'animate-color-shift'} text-white font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-lg`}
                >
                  <ShoppingBag className="h-5 w-5" />
                  {viewingProduct.stock_status === 'OUT OF STOCK' ? 'نفذت الكمية' : 'اطلب الآن'}
                </button>
              </div>

              {/* Related Products */}
              {relatedProducts.length > 0 && (
                <div className="mt-16 border-t border-brand-border pt-12">
                  <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
                    <div className="w-1 h-6 bg-brand-primary rounded-full" />
                    منتجات قد تعجبك
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {relatedProducts.map((product) => (
                      <div
                        key={product.w_code}
                        onClick={() => openProductPage(product)}
                        className="group bg-brand-card border border-brand-border rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all duration-200"
                      >
                        <div className="aspect-square relative overflow-hidden">
                          <img 
                            src={product.images[0]} 
                            alt={product.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="p-3">
                          <h3 className="text-[10px] font-bold line-clamp-1 mb-1 text-brand-text">
                            {product.title}
                          </h3>
                          <span className="text-brand-primary font-black text-xs">{product.sell_price} درهم</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Image Modal / Lightbox */}
      <AnimatePresence>
        {isImageModalOpen && viewingProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <button 
              className="absolute top-6 right-6 p-3 bg-brand-text/10 rounded-full text-brand-text hover:bg-brand-primary transition-colors z-[110]"
              onClick={(e) => { e.stopPropagation(); setIsImageModalOpen(false); }}
            >
              <X className="h-6 w-6" />
            </button>
            
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={viewingProduct.images[currentImageIndex]}
              alt={viewingProduct.title}
              className="max-w-full max-h-full object-contain shadow-2xl"
              referrerPolicy="no-referrer"
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            />
            
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-xs font-bold uppercase tracking-widest">
              انقر في أي مكان للإغلاق
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Form Popup */}
      <AnimatePresence>
        {isOrderFormOpen && viewingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOrderForm}
              className="absolute inset-0 bg-black/95 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-brand-card border border-brand-border rounded-[2.5rem] overflow-hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-form-title"
            >
              <button 
                onClick={closeOrderForm}
                aria-label="إغلاق النافذة"
                className="absolute top-6 left-6 z-10 bg-brand-text/5 hover:bg-brand-primary text-brand-text p-2 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="p-4 sm:p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
                {!isSuccess ? (
                  <>
                    <div className="text-center mb-4">
                      <h2 id="order-form-title" className="text-xl font-bold mb-1">تأكيد الطلب</h2>
                      <p className="text-brand-text-muted text-[10px]">يرجى ملء البيانات التالية لإتمام طلبك</p>
                    </div>

                    <form 
                      onSubmit={handleFormSubmit}
                      className="space-y-3"
                    >
                      {submitError && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-[10px] p-2 rounded-lg text-center font-bold">
                          {submitError}
                        </div>
                      )}
                      {/* Hidden Inputs */}
                      <input type="hidden" name="entry.216099083" value={viewingProduct.w_code} />
                      <input type="hidden" name="entry.1395650211" value={viewingProduct.title} />
                      <input type="hidden" name="entry.540852700" value={viewingProduct.sell_price} />
                      <input type="hidden" name="entry.139905504" value={orderQuantity} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative">
                          <User className="absolute right-3 top-3 h-4 w-4 text-gray-600" />
                          <input 
                            required
                            name="entry.1405363493"
                            type="text" 
                            placeholder="الاسم الكامل"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pr-10 pl-3 focus:outline-none focus:border-brand-primary transition-colors text-sm placeholder:text-[10px] invalid:border-red-500/50"
                          />
                        </div>

                        <div className="relative">
                          <Phone className="absolute right-3 top-3 h-4 w-4 text-gray-600" />
                          <input 
                            required
                            name="entry.837065099"
                            type="tel" 
                            placeholder="رقم الهاتف"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pr-10 pl-3 focus:outline-none focus:border-brand-primary transition-colors text-sm placeholder:text-[10px] text-right invalid:border-red-500/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <MapPin className="absolute right-3 top-3 h-4 w-4 text-gray-600" />
                          <input 
                            required
                            name="entry.731318579"
                            type="text" 
                            placeholder="المدينة"
                            autoComplete="off"
                            value={citySearch}
                            onChange={(e) => {
                              setCitySearch(e.target.value);
                              setSelectedCity(null);
                              setShowCitySuggestions(true);
                            }}
                            onFocus={() => setShowCitySuggestions(true)}
                            onBlur={() => {
                              // Small delay to allow clicking suggestions
                              setTimeout(() => {
                                setShowCitySuggestions(false);
                              }, 200);
                            }}
                            className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pr-10 pl-3 focus:outline-none focus:border-brand-primary transition-colors text-sm placeholder:text-[10px] invalid:border-red-500/50"
                          />
                          <AnimatePresence>
                            {citySuggestions.length > 0 && !selectedCity && showCitySuggestions && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-1 bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-2xl z-[60]"
                              >
                                {citySuggestions.map((city, index) => (
                                  <button
                                    key={`${city.name}-${index}`}
                                    type="button"
                                    onClick={() => {
                                      setCitySearch(city.name);
                                      setSelectedCity(city);
                                    }}
                                    className="w-full text-right px-3 py-2 hover:bg-brand-text/5 transition-colors text-[10px] border-b border-brand-border last:border-0"
                                  >
                                    {city.name}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="relative">
                          <MapPin className="absolute right-3 top-3 h-4 w-4 text-gray-600" />
                          <input 
                            required
                            name="entry.1663804639"
                            type="text" 
                            placeholder="العنوان"
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pr-10 pl-3 focus:outline-none focus:border-brand-primary transition-colors text-sm placeholder:text-[10px] invalid:border-red-500/50"
                          />
                        </div>
                      </div>

                      <div className={`grid ${viewingProduct.colors && viewingProduct.sizes ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                        {viewingProduct.colors && (
                          <div className="relative">
                            <Palette className="absolute right-3 top-3 h-4 w-4 text-gray-600" />
                            <select 
                              name="entry.490926552"
                              value={selectedColor}
                              onChange={(e) => setSelectedColor(e.target.value)}
                              className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pr-10 pl-3 focus:outline-none focus:border-brand-primary transition-colors text-sm appearance-none"
                            >
                              <option value="">اللون</option>
                              {viewingProduct.colors.split(',').map(c => (
                                <option key={c.trim()} value={c.trim()}>{c.trim()}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {viewingProduct.sizes && (
                          <div className="relative">
                            <Maximize2 className="absolute right-3 top-3 h-4 w-4 text-gray-600" />
                            <select 
                              name="entry.1049454346"
                              value={selectedSize}
                              onChange={(e) => setSelectedSize(e.target.value)}
                              className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 pr-10 pl-3 focus:outline-none focus:border-brand-primary transition-colors text-sm appearance-none"
                            >
                              <option value="">المقاس</option>
                              {viewingProduct.sizes.split(',').map(s => (
                                <option key={s.trim()} value={s.trim()}>{s.trim()}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <input 
                          type="number" 
                          value={orderQuantity}
                          onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                          min="1"
                          placeholder="الكمية"
                          className="w-full bg-brand-bg border border-brand-border rounded-xl py-2.5 px-3 focus:outline-none focus:border-brand-primary transition-colors text-sm placeholder:text-[10px]"
                        />
                      </div>

                      {/* Order Summary Box - Compact */}
                      <div className="bg-brand-bg/50 border border-brand-border rounded-2xl p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-brand-border bg-brand-card shrink-0">
                            <img 
                              src={viewingProduct.images[0]} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[10px] font-bold text-brand-text truncate">{viewingProduct.title}</h4>
                            <div className="text-[8px] text-brand-text-muted">
                              {orderQuantity} × {viewingProduct.sell_price}
                            </div>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-brand-border grid grid-cols-2 gap-x-4 gap-y-1">
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-brand-text-muted">المنتج:</span>
                            <span className="font-bold">{productPrice * orderQuantity} درهم</span>
                          </div>
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-brand-text-muted">التوصيل:</span>
                            <span className={`font-bold ${deliveryPrice === 0 ? 'text-green-500' : ''}`}>
                              {deliveryPrice === 0 ? 'مجاني' : `${deliveryPrice} درهم`}
                            </span>
                          </div>
                          <div className="col-span-2 flex items-center justify-between text-xs pt-1 border-t border-brand-border/50">
                            <span className="font-black">المجموع:</span>
                            <span className="font-black text-brand-primary text-base">{totalPrice} درهم</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full animate-color-shift text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-brand-primary/20"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            جاري الإرسال...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5" />
                            تأكيد الطلب
                          </>
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-8 animate-fade-in">
                    <div className="bg-green-500/20 p-6 rounded-full mb-6">
                      <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4">شكراً لك!</h2>
                    <p className="text-brand-text-muted mb-8">
                      تم استلام طلبك بنجاح. سنتصل بك قريباً لتأكيد التوصيل.
                    </p>
                    <button 
                      onClick={closeOrderForm}
                      className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-4 rounded-2xl transition-all"
                    >
                      إغلاق
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <iframe
        name="hidden_iframe"
        id="hidden_iframe"
        ref={iframeRef}
        style={{ display: 'none' }}
        onLoad={onIframeLoad}
      />

      {/* Footer */}
      <footer className="bg-brand-card border-t border-brand-border py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            {/* Brand Info */}
            <div className="text-center md:text-right">
              <img 
                src={LOGO_DARK} 
                alt="7ASAN STORE" 
                className="h-10 w-auto mx-auto md:mx-0 mb-6"
                referrerPolicy="no-referrer"
              />
              <p className="text-brand-text-muted text-sm leading-relaxed max-w-xs mx-auto md:mx-0">
                متجر حسن هو وجهتك الأولى للحصول على أحدث المنتجات الإلكترونية والذكية بجودة عالية وأسعار تنافسية في المغرب.
              </p>
            </div>

            {/* FAQ Section */}
            <div>
                      <h3 className="text-lg font-bold mb-6 flex items-center justify-center md:justify-start gap-2 text-brand-text">
                <HelpCircle className="h-5 w-5 text-brand-primary" />
                الأسئلة الشائعة
              </h3>
              <div className="space-y-4">
                {[
                  { q: 'كم يستغرق التوصيل؟', a: 'التوصيل يستغرق 24-48 ساعة في جميع المدن المغربية.' },
                  { q: 'هل يمكنني فحص المنتج؟', a: 'نعم، يمكنك فحص المنتج قبل الدفع لضمان الجودة.' },
                  { q: 'كيف يمكنني تتبع طلبي؟', a: 'سيتصل بك فريقنا لتأكيد الطلب وتزويدك بمعلومات التوصيل.' }
                ].map((faq, i) => (
                  <div key={i} className="border-b border-brand-border/50 pb-3">
                    <h4 className="text-xs font-bold text-brand-text mb-1">{faq.q}</h4>
                    <p className="text-[10px] text-brand-text-muted">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-brand-border text-center">
            <p className="text-brand-text-muted text-xs">
              جميع الحقوق محفوظة © {new Date().getFullYear()} 7ASAN STORE
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
