/**
 * EEA Pages Internationalization (i18n) System
 * 
 * Provides language switching functionality across all pages.
 * Supports English, French, and Spanish.
 */

(function() {
    'use strict';

    const I18N = {
        currentLang: 'en',
        translations: null,
        supportedLangs: ['en', 'fr', 'es'],
        defaultLang: 'en',

        /**
         * Initialize i18n system
         */
        async init() {
            // Determine language: URL param > localStorage > browser > default
            this.currentLang = this.detectLanguage();
            
            // Load translations
            await this.loadTranslations(this.currentLang);
            
            // Apply translations to page
            this.applyTranslations();
            
            // Set up language switcher if present
            this.setupLanguageSwitcher();
            
            // Save preference
            localStorage.setItem('eea-lang', this.currentLang);
            
            // Update HTML lang attribute
            document.documentElement.lang = this.currentLang;
        },

        /**
         * Detect the preferred language
         */
        detectLanguage() {
            // 1. Check URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const urlLang = urlParams.get('lang');
            if (urlLang && this.supportedLangs.includes(urlLang)) {
                return urlLang;
            }

            // 2. Check localStorage
            const storedLang = localStorage.getItem('eea-lang');
            if (storedLang && this.supportedLangs.includes(storedLang)) {
                return storedLang;
            }

            // 3. Check browser language
            const browserLang = navigator.language?.split('-')[0];
            if (browserLang && this.supportedLangs.includes(browserLang)) {
                return browserLang;
            }

            // 4. Default
            return this.defaultLang;
        },

        /**
         * Load translation file
         */
        async loadTranslations(lang) {
            try {
                // Determine the correct path based on context (iframe or main page)
                let basePath = '';
                if (window.parent !== window) {
                    // We're in an iframe, path is relative to parent
                    basePath = '';
                }
                
                const response = await fetch(`${basePath}lang/${lang}.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load ${lang} translations`);
                }
                this.translations = await response.json();
            } catch (error) {
                console.error('i18n: Error loading translations:', error);
                // Fallback to English if available
                if (lang !== this.defaultLang) {
                    console.log('i18n: Falling back to English');
                    await this.loadTranslations(this.defaultLang);
                }
            }
        },

        /**
         * Get a translation by key path (e.g., "global_computer.title")
         */
        t(keyPath) {
            if (!this.translations) return keyPath;
            
            const keys = keyPath.split('.');
            let value = this.translations;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    console.warn(`i18n: Missing translation for "${keyPath}"`);
                    return keyPath;
                }
            }
            
            return value;
        },

        /**
         * Apply translations to all elements with data-i18n attribute
         */
        applyTranslations() {
            const elements = document.querySelectorAll('[data-i18n]');
            
            elements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                const translation = this.t(key);
                
                if (translation !== key) {
                    // Check if we should set innerHTML or textContent
                    if (el.hasAttribute('data-i18n-html')) {
                        el.innerHTML = translation;
                    } else {
                        el.textContent = translation;
                    }
                }
            });

            // Handle placeholder attributes
            const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
            placeholders.forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                const translation = this.t(key);
                if (translation !== key) {
                    el.placeholder = translation;
                }
            });

            // Handle title attributes
            const titles = document.querySelectorAll('[data-i18n-title]');
            titles.forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                const translation = this.t(key);
                if (translation !== key) {
                    el.title = translation;
                }
            });
        },

        /**
         * Set up language switcher buttons/dropdown
         */
        setupLanguageSwitcher() {
            // Handle language buttons
            const langButtons = document.querySelectorAll('[data-lang]');
            langButtons.forEach(btn => {
                const lang = btn.getAttribute('data-lang');
                
                // Mark current language as active
                if (lang === this.currentLang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
                
                // Add click handler
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchLanguage(lang);
                });
            });

            // Handle language dropdown
            const langSelect = document.querySelector('#lang-select');
            if (langSelect) {
                langSelect.value = this.currentLang;
                langSelect.addEventListener('change', (e) => {
                    this.switchLanguage(e.target.value);
                });
            }
        },

        /**
         * Switch to a new language
         */
        async switchLanguage(lang) {
            if (!this.supportedLangs.includes(lang)) {
                console.warn(`i18n: Unsupported language "${lang}"`);
                return;
            }

            this.currentLang = lang;
            localStorage.setItem('eea-lang', lang);
            
            // Update URL without reload
            const url = new URL(window.location);
            url.searchParams.set('lang', lang);
            window.history.replaceState({}, '', url);
            
            // Reload translations and apply
            await this.loadTranslations(lang);
            this.applyTranslations();
            this.setupLanguageSwitcher();
            
            // Update HTML lang attribute
            document.documentElement.lang = lang;
            
            // Dispatch event for other scripts to react
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
        },

        /**
         * Get current language
         */
        getCurrentLang() {
            return this.currentLang;
        },

        /**
         * Notify iframes of language change (for parent pages)
         */
        notifyIframes(lang) {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                try {
                    if (iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'langChange', lang }, '*');
                    }
                } catch (e) {
                    // Cross-origin iframe, skip
                }
            });
        }
    };

    // Listen for language change messages from parent
    window.addEventListener('message', async (event) => {
        if (event.data && event.data.type === 'langChange') {
            await I18N.switchLanguage(event.data.lang);
        }
    });

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => I18N.init());
    } else {
        I18N.init();
    }

    // Export for global access
    window.I18N = I18N;
})();
