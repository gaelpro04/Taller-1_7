// Módulo de formulario de artículos con Sistema de Roles
//Gael Jovani Lopez Garcia 11916199
const ArticleForm = (() => {
    // Variables globales
    let currentRole = null;
    
    // Variables privadas
    let form, submitBtn, successMessage, formSection, newArticleBtn;
    let titleInput, summaryInput, authorInput, emailInput, keywordsInput, categorySelect, documentInput;
    let titleError, summaryError, authorError, emailError, documentError, charCount;
    let searchInput, categoryFilter, articlesTable, articlesCount;
    let articles = [];
    let filteredArticles = [];
    let currentEditingId = null;
    let formData = {};
    let reviewers = [];
    let filteredReviewers = [];
    
    // Sistema de Roles
    const RoleManager = {
        init() {
            this.setupRoleSelector();
            this.checkStoredRole();
        },
        
        setupRoleSelector() {
            const roleCards = document.querySelectorAll('.role-card');
            roleCards.forEach(card => {
                card.addEventListener('click', (e) => {
                    const role = e.currentTarget.dataset.role;
                    this.selectRole(role);
                });
            });
        },
        
        selectRole(role) {
            currentRole = role;
            localStorage.setItem('userRole', role);
            
            // Actualizar UI
            document.querySelectorAll('.role-card').forEach(card => {
                card.classList.remove('selected');
            });
            document.querySelector(`[data-role="${role}"]`).classList.add('selected');
            
            // Mostrar contenido principal después de breve delay
            setTimeout(() => {
                this.showMainContent();
                this.configureInterface(role);
                
                // ESPERAR a que el DOM esté visible antes de inicializar elementos
                setTimeout(() => {
                    initializeElements();
                    setupEventListeners();
                    updateSubmitButton();
                    
                    // Inicializar Network Monitor
                    networkMonitor.updateStatus(navigator.onLine ? 'online' : 'offline');
                    
                    // Cargar datos iniciales
                    loadArticlesFromStorage();
                    loadReviewersFromStorage();
                }, 100);
            }, 500);
        },
        
        checkStoredRole() {
            const storedRole = localStorage.getItem('userRole');
            // NO auto-seleccionar rol al iniciar - dejar que usuario elija
            // if (storedRole) {
            //     this.selectRole(storedRole);
            // }
        },
        
        showMainContent() {
            document.getElementById('roleSelector').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
        },
        
        configureInterface(role) {
            const header = document.querySelector('.header p');
            const tabs = document.querySelector('.tabs');
            const articlesTab = document.getElementById('articlesTab');
            const reviewersTab = document.getElementById('reviewersTab');
            
            switch(role) {
                case 'author':
                    if (header) header.textContent = 'Panel del Autor';
                    // Autor solo ve artículos
                    if (tabs) tabs.style.display = 'none';
                    if (reviewersTab) reviewersTab.style.display = 'none';
                    if (articlesTab) articlesTab.style.display = 'block';
                    break;
                    
                case 'editor':
                    if (header) header.textContent = 'Panel del Editor';
                    // Editor ve todo
                    if (tabs) tabs.style.display = 'flex';
                    if (articlesTab) articlesTab.style.display = 'block';
                    if (reviewersTab) reviewersTab.style.display = 'block';
                    break;
                    
                case 'reviewer':
                    if (header) header.textContent = 'Panel del Revisor';
                    // Revisor solo ve artículos asignados (vista especializada)
                    if (tabs) tabs.style.display = 'none';
                    if (reviewersTab) reviewersTab.style.display = 'none';
                    if (articlesTab) {
                        articlesTab.style.display = 'block';
                        // TODO: Implementar vista de artículos asignados al revisor
                        // Por ahora mostrar todos los artículos con opción de revisión
                    }
                    break;
            }
        },
        
        getCurrentRole() {
            return currentRole;
        }
    };
    
    // IndexedDB Storage Layer
    class ArticleStorage {
        constructor() {
            this.dbName = 'ArticlesDB';
            this.dbVersion = 3;
            this.db = null;
        }
        
        async initDB() {
            if (this.db) return this.db;
            
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onerror = () => {
                    console.error('Error opening IndexedDB:', request.error);
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    this.db = request.result;
                    console.log('✅ IndexedDB abierta correctamente con versión', this.dbVersion);
                    resolve(this.db);
                };
                
                request.onupgradeneeded = (event) => {
                    console.log('🔄 Actualizando IndexedDB schema a versión', event.newVersion);
                    const db = event.target.result;
                    
                    if (!db.objectStoreNames.contains('articles')) {
                        const articleStore = db.createObjectStore('articles', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        articleStore.createIndex('title', 'title', { unique: false });
                        articleStore.createIndex('author', 'author', { unique: false });
                        articleStore.createIndex('category', 'category', { unique: false });
                    }
                    
                    if (!db.objectStoreNames.contains('reviewers')) {
                        const reviewerStore = db.createObjectStore('reviewers', { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        reviewerStore.createIndex('name', 'name', { unique: false });
                        reviewerStore.createIndex('expertise', 'expertise', { unique: false });
                    }
                };
            });
        }
        
        async save(article) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readwrite');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.add(article);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error saving article:', error);
                throw error;
            }
        }
        
        async getAll() {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readonly');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error getting articles:', error);
                return [];
            }
        }
        
        async update(id, changes) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readwrite');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.get(id);
                    request.onsuccess = () => {
                        const article = request.result;
                        if (article) {
                            Object.assign(article, changes);
                            const updateRequest = store.put(article);
                            updateRequest.onsuccess = () => resolve(updateRequest.result);
                            updateRequest.onerror = () => reject(updateRequest.error);
                        } else {
                            reject(new Error('Article not found'));
                        }
                    };
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error updating article:', error);
                throw error;
            }
        }
        
        async delete(id) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['articles'], 'readwrite');
                    const store = transaction.objectStore('articles');
                    
                    const request = store.delete(id);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error deleting article:', error);
                throw error;
            }
        }
        
        // Métodos para revisores
        async saveReviewer(reviewer) {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    if (!this.db.objectStoreNames.contains('reviewers')) {
                        console.error('❌ Object store "reviewers" no encontrado');
                        reject(new Error('Object store "reviewers" no encontrado. La base de datos necesita ser reinicializada.'));
                        return;
                    }
                    
                    const transaction = this.db.transaction(['reviewers'], 'readwrite');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.add(reviewer);
                    request.onsuccess = () => {
                        console.log('✅ Revisor guardado exitosamente');
                        resolve(request.result);
                    };
                    request.onerror = () => {
                        console.error('❌ Error guardando revisor:', request.error);
                        reject(request.error);
                    };
                });
            } catch (error) {
                console.error('Error en saveReviewer:', error);
                reject(error);
            }
        }
        
        async getAllReviewers() {
            try {
                await this.initDB();
                return new Promise((resolve, reject) => {
                    if (!this.db.objectStoreNames.contains('reviewers')) {
                        console.log('⚠️ Object store "reviewers" no encontrado, inicializando vacío...');
                        resolve([]);
                        return;
                    }
                    
                    const transaction = this.db.transaction(['reviewers'], 'readonly');
                    const store = transaction.objectStore('reviewers');
                    
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } catch (error) {
                console.error('Error en getAllReviewers:', error);
                return [];
            }
        }
    }
    
    const storage = new ArticleStorage();
    
    // Network Monitor
    class NetworkMonitor {
        constructor() {
            this.isOnline = navigator.onLine;
            this.callbacks = { online: [], offline: [] };
            this.setupEventListeners();
        }
        
        setupEventListeners() {
            window.addEventListener('online', () => this.triggerCallbacks('online'));
            window.addEventListener('offline', () => this.triggerCallbacks('offline'));
        }
        
        onOnline(callback) {
            this.callbacks.online.push(callback);
        }
        
        onOffline(callback) {
            this.callbacks.offline.push(callback);
        }
        
        triggerCallbacks(type) {
            this.callbacks[type].forEach(callback => callback());
        }
        
        updateStatus(status) {
            const statusElement = document.getElementById('connectionStatus');
            if (statusElement) {
                statusElement.className = `connection-status ${status}`;
                statusElement.textContent = status === 'online' ? '🟢 Conectado' : 
                                                   status === 'offline' ? '🔴 Sin Conexión' : 
                                                   '🔄 Sincronizando...';
            }
        }
    }
    
    const networkMonitor = new NetworkMonitor();
    
    // Inicializar elementos del DOM
    const initializeElements = () => {
        form = document.getElementById('articleForm');
        submitBtn = document.getElementById('submitBtn');
        successMessage = document.getElementById('successMessage');
        formSection = form ? form.closest('.form-section') : null;
        newArticleBtn = document.getElementById('newArticleBtn');
        
        titleInput = document.getElementById('title');
        summaryInput = document.getElementById('summary');
        authorInput = document.getElementById('author');
        emailInput = document.getElementById('email');
        keywordsInput = document.getElementById('keywords');
        categorySelect = document.getElementById('category');
        documentInput = document.getElementById('document');
        
        titleError = document.getElementById('titleError');
        summaryError = document.getElementById('summaryError');
        authorError = document.getElementById('authorError');
        emailError = document.getElementById('emailError');
        documentError = document.getElementById('documentError');
        charCount = document.getElementById('charCount');
        
        searchInput = document.getElementById('searchInput');
        categoryFilter = document.getElementById('categoryFilter');
        articlesTable = document.getElementById('articlesTable');
        articlesCount = document.getElementById('articlesCount');
    };
    
    // Validación de formulario
    const showError = (input, errorElement) => {
        input.classList.add('error');
        errorElement.style.display = 'block';
    };
    
    const hideError = (input, errorElement) => {
        input.classList.remove('error');
        errorElement.style.display = 'none';
    };
    
    const updateCharCount = () => {
        const length = summaryInput.value.length;
        charCount.textContent = length;
        if (length < 50) {
            charCount.style.color = '#e74c3c';
        } else {
            charCount.style.color = '#27ae60';
        }
    };
    
    // Validaciones
    const validateTitle = () => {
        const value = titleInput.value.trim();
        formData.title = value;
        
        if (value.length === 0) {
            showError(titleInput, titleError);
            return false;
        } else if (value.length < 5) {
            titleError.textContent = 'El título debe tener al menos 5 caracteres';
            showError(titleInput, titleError);
            return false;
        } else {
            hideError(titleInput, titleError);
            return true;
        }
    };
    
    const validateSummary = () => {
        const value = summaryInput.value.trim();
        formData.summary = value;
        
        if (value.length === 0) {
            showError(summaryInput, summaryError);
            updateCharCount();
            return false;
        } else if (value.length < 50) {
            summaryError.textContent = 'El resumen debe tener al menos 50 caracteres';
            showError(summaryInput, summaryError);
            updateCharCount();
            return false;
        } else {
            hideError(summaryInput, summaryError);
            updateCharCount();
            return true;
        }
    };
    
    const validateAuthor = () => {
        const value = authorInput.value.trim();
        formData.author = value;
        
        if (value.length === 0) {
            showError(authorInput, authorError);
            return false;
        } else if (value.length < 3) {
            authorError.textContent = 'El nombre del autor debe tener al menos 3 caracteres';
            showError(authorInput, authorError);
            return false;
        } else {
            hideError(authorInput, authorError);
            return true;
        }
    };
    
    const validateEmail = () => {
        const value = emailInput.value.trim();
        formData.email = value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (value.length === 0) {
            showError(emailInput, emailError);
            return false;
        } else if (!emailRegex.test(value)) {
            emailError.textContent = 'Ingrese un correo electrónico válido';
            showError(emailInput, emailError);
            return false;
        } else {
            hideError(emailInput, emailError);
            return true;
        }
    };
    
    const validateDocument = () => {
        const file = documentInput.files[0];
        if (!file) {
            showError(documentInput, documentError);
            return false;
        } else {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
            
            if (file.size > maxSize) {
                documentError.textContent = 'El documento no debe exceder 10MB';
                showError(documentInput, documentError);
                return false;
            } else if (!allowedTypes.includes(file.type)) {
                documentError.textContent = 'Formato de archivo no permitido';
                showError(documentInput, documentError);
                return false;
            } else {
                hideError(documentInput, documentError);
                return true;
            }
        }
    };
    
    const updateSubmitButton = () => {
        const isTitleValid = validateTitle();
        const isSummaryValid = validateSummary();
        const isAuthorValid = validateAuthor();
        const isEmailValid = validateEmail();
        const isDocumentValid = validateDocument();
        
        submitBtn.disabled = !(isTitleValid && isSummaryValid && isAuthorValid && isEmailValid && isDocumentValid);
    };
    
    const clearForm = () => {
        form.reset();
        formData = {
            title: '',
            summary: '',
            author: '',
            email: '',
            keywords: '',
            category: ''
        };
        
        [titleInput, summaryInput, authorInput, emailInput, keywordsInput, categorySelect, documentInput].forEach(input => {
            if (input) hideError(input, input.nextElementSibling);
        });
        
        updateCharCount();
        updateSubmitButton();
    };
    
    const showSuccessMessage = (customMessage = null) => {
        formSection.style.display = 'none';
        successMessage.style.display = 'block';
        
        if (customMessage) {
            const messageElement = successMessage.querySelector('p');
            if (messageElement) {
                messageElement.textContent = customMessage;
            }
        }
    };
    
    const showErrorMessage = (message) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message global';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    };
    
    // Manejo de envío del formulario
    const handleArticleSubmit = async (event) => {
        event.preventDefault();
        
        const isTitleValid = validateTitle();
        const isSummaryValid = validateSummary();
        const isAuthorValid = validateAuthor();
        const isEmailValid = validateEmail();
        const isDocumentValid = validateDocument();
        
        if (!isTitleValid || !isSummaryValid || !isAuthorValid || !isEmailValid || !isDocumentValid) {
            return;
        }
        
        formData.keywords = keywordsInput.value.trim();
        formData.category = categorySelect.value;
        
        const newArticle = {
            id: currentEditingId || Date.now().toString(),
            ...formData,
            date: new Date().toLocaleDateString('es-ES'),
            timestamp: new Date().toISOString(),
            deviceId: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            documentName: documentInput.files[0] ? documentInput.files[0].name : null,
            documentSize: documentInput.files[0] ? documentInput.files[0].size : null
        };
        
        try {
            await storage.save(newArticle);
            articles.unshift(newArticle);
            
            console.log('Artículo guardado:', newArticle);
            filterArticles();
            
            const message = `Artículo registrado exitosamente (${newArticle.deviceId})`;
            showSuccessMessage(message);
            clearForm();
        } catch (error) {
            console.error('Error al guardar artículo:', error);
            showErrorMessage('Error al guardar el artículo. Por favor, inténtelo nuevamente.');
        }
    };
    
    // Cargar artículos desde IndexedDB
    const loadArticlesFromStorage = async () => {
        try {
            console.log('Cargando artículos desde IndexedDB...');
            await storage.initDB();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            articles = await storage.getAll();
            console.log(`Se cargaron ${articles.length} artículos desde IndexedDB`);
            filterArticles();
        } catch (error) {
            console.error('Error al cargar artículos:', error);
            articles = [];
            filterArticles();
        }
    };
    
    // Cargar revisores desde IndexedDB
    const loadReviewersFromStorage = async () => {
        try {
            console.log('Cargando revisores desde IndexedDB...');
            await storage.initDB();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            reviewers = await storage.getAllReviewers();
            console.log(`Se cargaron ${reviewers.length} revisores desde IndexedDB`);
            filterReviewers();
        } catch (error) {
            console.error('Error al cargar revisores:', error);
            reviewers = [];
            filterReviewers();
        }
    };
    
    // Filtrar y renderizar artículos
    const filterArticles = () => {
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const categoryValue = categoryFilter ? categoryFilter.value : '';
        
        filteredArticles = articles.filter(article => {
            const matchesSearch = !searchTerm || 
                article.title.toLowerCase().includes(searchTerm) ||
                article.author.toLowerCase().includes(searchTerm) ||
                (article.keywords && article.keywords.toLowerCase().includes(searchTerm));
            
            const matchesCategory = !categoryValue || article.category === categoryValue;
            
            return matchesSearch && matchesCategory;
        });
        
        renderArticles();
    };
    
    // Renderizar artículos con opción de asignación para Editor
    const renderArticles = () => {
        if (!articlesTable) return;
        
        if (filteredArticles.length === 0) {
            articlesTable.innerHTML = `
                <div class="no-articles">
                    <p>No hay artículos registrados aún. Registra tu primer artículo para comenzar.</p>
                </div>
            `;
            if (articlesCount) articlesCount.textContent = '0';
            return;
        }
        
        const articlesHTML = filteredArticles.map(article => {
            const isEditor = currentRole === 'editor';
            const hasReviewer = article.assignedReviewer;
            
            return `
            <div class="article-item" data-id="${article.id}">
                <div class="article-header">
                    <h3 class="article-title">${article.title}</h3>
                    ${article.category ? `<span class="article-category">${getCategoryLabel(article.category)}</span>` : ''}
                    ${article.deviceId ? `<span class="device-badge">📱 ${article.deviceId === 'mobile' ? 'Celular' : 'Laptop'}</span>` : ''}
                    ${hasReviewer ? `<span class="reviewer-assigned">✅ ${hasReviewer}</span>` : ''}
                </div>
                <div class="article-meta">
                    <span class="article-author">Autor: ${article.author}</span>
                    <span class="article-date">${article.date}</span>
                </div>
                <div class="article-summary">
                    ${article.summary}
                </div>
                ${article.documentName ? `
                <div class="article-document">
                    <span class="document-info">📄 ${article.documentName}</span>
                </div>
                ` : ''}
                <div class="article-actions">
                    <button class="btn btn-small btn-primary" onclick="editArticle('${article.id}')">Editar</button>
                    <button class="btn btn-small btn-secondary" onclick="deleteArticle('${article.id}')">Eliminar</button>
                    ${isEditor ? `
                        <button class="btn btn-small btn-info" onclick="assignReviewer('${article.id}')">
                            ${hasReviewer ? 'Cambiar Revisor' : 'Asignar Revisor'}
                        </button>
                    ` : ''}
                </div>
            </div>
        `}).join('');
        
        articlesTable.innerHTML = articlesHTML;
        if (articlesCount) articlesCount.textContent = filteredArticles.length;
    };
    
    const getCategoryLabel = (category) => {
        const labels = {
            'ciencias': 'Ciencias',
            'tecnologia': 'Tecnología',
            'educacion': 'Educación',
            'medicina': 'Medicina',
            'ingenieria': 'Ingeniería',
            'sociales': 'Ciencias Sociales',
            'artes': 'Artes y Humanidades',
            'otro': 'Otro'
        };
        return labels[category] || category;
    };
    
    // Función para asignar revisor a artículo (solo para Editor)
    const assignReviewer = (articleId) => {
        if (currentRole !== 'editor') {
            showErrorMessage('Solo los Editores pueden asignar revisores');
            return;
        }
        
        // Obtener lista de revisores disponibles
        const availableReviewers = reviewers.filter(r => r.status !== 'inactive');
        
        if (availableReviewers.length === 0) {
            showErrorMessage('No hay revisores disponibles. Primero registra un revisor.');
            return;
        }
        
        // Crear modal simple para seleccionar revisor
        const modal = document.createElement('div');
        modal.className = 'reviewer-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Asignar Revisor</h3>
                <p>Selecciona un revisor para este artículo:</p>
                <select id="reviewerSelect">
                    <option value="">-- Seleccionar Revisor --</option>
                    ${availableReviewers.map(r => `
                        <option value="${r.name}">${r.name} - ${r.expertise}</option>
                    `).join('')}
                </select>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="confirmAssignReviewer('${articleId}')">Asignar</button>
                    <button class="btn btn-secondary" onclick="closeReviewerModal()">Cancelar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    };
    
    // Confirmar asignación de revisor
    const confirmAssignReviewer = (articleId) => {
        const selectedReviewer = document.getElementById('reviewerSelect').value;
        
        if (!selectedReviewer) {
            showErrorMessage('Por favor selecciona un revisor');
            return;
        }
        
        // Actualizar artículo con revisor asignado
        const articleIndex = articles.findIndex(a => a.id === articleId);
        if (articleIndex !== -1) {
            articles[articleIndex].assignedReviewer = selectedReviewer;
            articles[articleIndex].assignedDate = new Date().toLocaleDateString('es-ES');
            
            // Guardar en IndexedDB
            storage.update(articleId, articles[articleIndex]).then(() => {
                showSuccessMessage(`Revisor ${selectedReviewer} asignado exitosamente`);
                closeReviewerModal();
                renderArticles();
            }).catch(error => {
                console.error('Error asignando revisor:', error);
                showErrorMessage('Error al asignar revisor');
            });
        }
    };
    
    // Cerrar modal de asignación
    const closeReviewerModal = () => {
        const modal = document.querySelector('.reviewer-modal');
        if (modal) {
            modal.remove();
        }
    };
    
    // Configurar event listeners
    const setupEventListeners = () => {
        if (form) {
            form.addEventListener('submit', handleArticleSubmit);
        }
        
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                validateTitle();
                updateSubmitButton();
            });
        }
        
        if (summaryInput) {
            summaryInput.addEventListener('input', () => {
                validateSummary();
                updateCharCount();
                updateSubmitButton();
            });
        }
        
        if (authorInput) {
            authorInput.addEventListener('input', () => {
                validateAuthor();
                updateSubmitButton();
            });
        }
        
        if (emailInput) {
            emailInput.addEventListener('input', () => {
                validateEmail();
                updateSubmitButton();
            });
        }
        
        if (documentInput) {
            documentInput.addEventListener('change', validateDocument);
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', filterArticles);
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', filterArticles);
        }
        
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                if (form) form.dispatchEvent(new Event('submit'));
            });
        }
        
        if (newArticleBtn) {
            newArticleBtn.addEventListener('click', () => {
                if (successMessage) successMessage.style.display = 'none';
                if (formSection) formSection.style.display = 'block';
                clearForm();
            });
        }
    };
    
    // Funciones placeholder para revisores
    const filterReviewers = () => {
        filteredReviewers = reviewers;
    };
    
    const renderReviewers = () => {
        // Placeholder - implementar si se necesita
    };
    
    // Inicialización principal
    const init = async () => {
        RoleManager.init();
    };
    
    // Inicializar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);
    
    // Exponer funciones globalmente
    window.assignReviewer = assignReviewer;
    window.confirmAssignReviewer = confirmAssignReviewer;
    window.closeReviewerModal = closeReviewerModal;
    window.ArticleForm = {
        init,
        submitArticle: handleArticleSubmit,
        clearForm,
        filterArticles,
        deleteArticle: (id) => {
            if (confirm('¿Estás seguro de que deseas eliminar este artículo?')) {
                console.log('Eliminando artículo:', id);
                articles = articles.filter(a => a.id !== id);
                filterArticles();
            }
        },
        editArticle: (id) => {
            console.log('Editando artículo:', id);
            const article = articles.find(a => a.id === id);
            if (article) {
                titleInput.value = article.title;
                summaryInput.value = article.summary;
                authorInput.value = article.author;
                emailInput.value = article.email;
                keywordsInput.value = article.keywords || '';
                categorySelect.value = article.category || '';
                currentEditingId = id;
                updateSubmitButton();
            }
        }
    };
})();
