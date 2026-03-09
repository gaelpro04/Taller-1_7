// Módulo de formulario de artículos - Versión Funcional con Firebase
//Gael Jovani Lopez Garcia 11916199
const ArticleForm = (() => {
    // Variables globales
    let currentRole = null;
    
    // Variables privadas
    let form, submitBtn, successMessage, formSection, newArticleBtn;
    let titleInput, summaryInput, authorInput, emailInput, keywordsInput, categorySelect, documentInput;
    let titleError, summaryError, authorError, emailError, documentError, charCount;
    let searchInput, categoryFilter, articlesTable, articlesCount;
    // Variables para formulario de revisores
    let reviewerForm, submitReviewerBtn, reviewerSuccessMessage, newReviewerBtn;
    let reviewerNameInput, reviewerEmailInput, reviewerExpertiseInput;
    let reviewerNameError, reviewerEmailError, reviewerExpertiseError;
    let reviewerSearchInput, expertiseFilter, reviewersTable, reviewersCount;
    let articles = [];
    let filteredArticles = [];
    let currentEditingId = null;
    let formData = {};
    let reviewers = [];
    let filteredReviewers = [];
    
    // Sistema de Almacenamiento - Firebase Firestore
    const ArticleStorage = {
        // Colecciones Firebase
        articlesCollection: () => db.collection('articles'),
        reviewersCollection: () => db.collection('reviewers'),
        
        // Guardar artículo en Firebase
        async save(article) {
            try {
                console.log('📝 Guardando artículo en Firebase:', article);
                const docRef = this.articlesCollection().doc(article.id);
                await docRef.set(article);
                console.log('✅ Artículo guardado en Firebase');
                return article;
            } catch (error) {
                console.error('❌ Error guardando artículo:', error);
                throw error;
            }
        },
        
        // Guardar revisor en Firebase
        async saveReviewer(reviewer) {
            try {
                console.log('👥 Guardando revisor en Firebase:', reviewer);
                const docRef = this.reviewersCollection().doc(reviewer.id);
                await docRef.set(reviewer);
                console.log('✅ Revisor guardado en Firebase');
                return reviewer;
            } catch (error) {
                console.error('❌ Error guardando revisor:', error);
                throw error;
            }
        },
        
        // Obtener todos los artículos de Firebase
        async getAll() {
            try {
                console.log('📚 Cargando artículos desde Firebase...');
                const snapshot = await this.articlesCollection().get();
                const articles = snapshot.docs.map(doc => doc.data());
                console.log('✅ Artículos cargados:', articles.length);
                return articles;
            } catch (error) {
                console.error('❌ Error cargando artículos:', error);
                return [];
            }
        },
        
        // Obtener todos los revisores de Firebase
        async getAllReviewers() {
            try {
                console.log('👥 Cargando revisores desde Firebase...');
                const snapshot = await this.reviewersCollection().get();
                const reviewers = snapshot.docs.map(doc => doc.data());
                console.log('✅ Revisores cargados:', reviewers.length);
                return reviewers;
            } catch (error) {
                console.error('❌ Error cargando revisores:', error);
                return [];
            }
        },
        
        // Eliminar artículo
        async delete(id) {
            try {
                console.log('🗑️ Eliminando artículo:', id);
                await this.articlesCollection().doc(id).delete();
                console.log('✅ Artículo eliminado');
            } catch (error) {
                console.error('❌ Error eliminando artículo:', error);
                throw error;
            }
        },
        
        // Eliminar revisor
        async deleteReviewer(id) {
            try {
                console.log('🗑️ Eliminando revisor:', id);
                await this.reviewersCollection().doc(id).delete();
                console.log('✅ Revisor eliminado');
            } catch (error) {
                console.error('❌ Error eliminando revisor:', error);
                throw error;
            }
        }
    };
    
    const storage = ArticleStorage;
    
    // Sistema de Roles
    const RoleManager = {
        init() {
            this.setupRoleButtons();
            this.loadSavedRole();
        },
        
        setupRoleButtons() {
            const roleButtons = document.querySelectorAll('.role-btn');
            roleButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const role = btn.dataset.role;
                    this.selectRole(role);
                });
            });
        },
        
        selectRole(role) {
            currentRole = role;
            localStorage.setItem('userRole', role);
            
            // Actualizar UI de botones
            const roleButtons = document.querySelectorAll('.role-btn');
            roleButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.role === role) {
                    btn.classList.add('active');
                }
            });
            
            // Mostrar contenido principal
            const roleSelection = document.querySelector('.role-selection');
            const mainContent = document.querySelector('.main-content');
            if (roleSelection) roleSelection.style.display = 'none';
            if (mainContent) mainContent.style.display = 'block';
            
            // Configurar interfaz según rol
            this.configureInterface(role);
            
            // Cargar datos después de un pequeño delay
            setTimeout(() => {
                initializeElements();
                setupEventListeners();
                updateSubmitButton();
                networkMonitor.updateStatus();
                loadArticlesFromStorage();
                loadReviewersFromStorage();
            }, 100);
        },
        
        loadSavedRole() {
            const savedRole = localStorage.getItem('userRole');
            if (savedRole) {
                this.selectRole(savedRole);
            }
        },
        
        configureInterface(role) {
            const header = document.querySelector('.header p');
            const tabs = document.querySelector('.tabs');
            const articlesTab = document.getElementById('articlesTab');
            const reviewersTab = document.getElementById('reviewersTab');
            
            switch(role) {
                case 'author':
                    if (header) header.textContent = 'Panel del Autor';
                    if (tabs) tabs.style.display = 'none';
                    if (reviewersTab) reviewersTab.style.display = 'none';
                    if (articlesTab) articlesTab.style.display = 'block';
                    const formSection = document.querySelector('.form-section');
                    if (formSection) {
                        formSection.style.display = 'block';
                    }
                    const newArticleBtn = document.getElementById('newArticleBtn');
                    if (newArticleBtn) {
                        newArticleBtn.style.display = 'block';
                    }
                    break;
                    
                case 'editor':
                    if (header) header.textContent = 'Panel del Editor';
                    if (tabs) tabs.style.display = 'flex';
                    if (articlesTab) articlesTab.style.display = 'block';
                    if (reviewersTab) reviewersTab.style.display = 'block';
                    const formSectionEditor = document.querySelector('.form-section');
                    if (formSectionEditor) {
                        formSectionEditor.style.display = 'none';
                    }
                    const newArticleBtnEditor = document.getElementById('newArticleBtn');
                    if (newArticleBtnEditor) {
                        newArticleBtnEditor.style.display = 'none';
                    }
                    break;
                    
                case 'reviewer':
                    if (header) header.textContent = 'Panel del Revisor';
                    if (tabs) tabs.style.display = 'none';
                    if (reviewersTab) reviewersTab.style.display = 'none';
                    if (articlesTab) {
                        articlesTab.style.display = 'block';
                        const formSection = document.querySelector('.form-section');
                        if (formSection) {
                            formSection.style.display = 'none';
                        }
                        const newArticleBtn = document.getElementById('newArticleBtn');
                        if (newArticleBtn) {
                            newArticleBtn.style.display = 'none';
                        }
                        if (articlesTable) {
                            articlesTable.innerHTML = `
                                <div class="reviewer-welcome">
                                    <h3>📋 Artículos Asignados para Revisión</h3>
                                    <p>Aquí se muestran todos los artículos con revisor asignado.</p>
                                </div>
                            `;
                        }
                    }
                    break;
            }
        },
        
        getCurrentRole() {
            return currentRole;
        }
    };
    
    // Sistema de Monitoreo de Red
    class NetworkMonitor {
        constructor() {
            this.isOnline = navigator.onLine;
            this.setupEventListeners();
        }
        
        setupEventListeners() {
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.updateStatus();
            });
            
            window.addEventListener('offline', () => {
                this.isOnline = false;
                this.updateStatus();
            });
        }
        
        updateStatus() {
            const statusElement = document.getElementById('connectionStatus');
            if (statusElement) {
                statusElement.textContent = this.isOnline ? '🟢 En línea' : '🔴 Sin conexión';
                statusElement.className = this.isOnline ? 'online' : 'offline';
            }
        }
    }
    
    const networkMonitor = new NetworkMonitor();
    
    // Inicializar elementos del DOM
    const initializeElements = () => {
        // Elementos de formulario de artículos
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
        
        // Elementos de formulario de revisores
        reviewerForm = document.getElementById('reviewerForm');
        submitReviewerBtn = document.getElementById('submitReviewerBtn');
        reviewerSuccessMessage = document.getElementById('reviewerSuccessMessage');
        newReviewerBtn = document.getElementById('newReviewerBtn');
        
        reviewerNameInput = document.getElementById('reviewerName');
        reviewerEmailInput = document.getElementById('reviewerEmail');
        reviewerExpertiseInput = document.getElementById('reviewerExpertise');
        
        reviewerNameError = document.getElementById('reviewerNameError');
        reviewerEmailError = document.getElementById('reviewerEmailError');
        reviewerExpertiseError = document.getElementById('reviewerExpertiseError');
        
        reviewerSearchInput = document.getElementById('reviewerSearchInput');
        expertiseFilter = document.getElementById('expertiseFilter');
        reviewersTable = document.getElementById('reviewersTable');
        reviewersCount = document.getElementById('reviewersCount');
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
    
    // Validaciones para formulario de revisores
    const validateReviewerName = () => {
        const value = reviewerNameInput.value.trim();
        if (value.length === 0) {
            showError(reviewerNameInput, reviewerNameError);
            return false;
        } else if (value.length < 3) {
            reviewerNameError.textContent = 'El nombre debe tener al menos 3 caracteres';
            showError(reviewerNameInput, reviewerNameError);
            return false;
        } else {
            hideError(reviewerNameInput, reviewerNameError);
            return true;
        }
    };
    
    const validateReviewerEmail = () => {
        const value = reviewerEmailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (value.length === 0) {
            showError(reviewerEmailInput, reviewerEmailError);
            return false;
        } else if (!emailRegex.test(value)) {
            reviewerEmailError.textContent = 'Ingrese un correo electrónico válido';
            showError(reviewerEmailInput, reviewerEmailError);
            return false;
        } else {
            hideError(reviewerEmailInput, reviewerEmailError);
            return true;
        }
    };
    
    const validateReviewerExpertise = () => {
        const value = reviewerExpertiseInput.value;
        if (value === '') {
            showError(reviewerExpertiseInput, reviewerExpertiseError);
            return false;
        } else {
            hideError(reviewerExpertiseInput, reviewerExpertiseError);
            return true;
        }
    };
    
    const updateReviewerSubmitButton = () => {
        const isNameValid = validateReviewerName();
        const isEmailValid = validateReviewerEmail();
        const isExpertiseValid = validateReviewerExpertise();
        
        submitReviewerBtn.disabled = !(isNameValid && isEmailValid && isExpertiseValid);
    };
    
    const clearReviewerForm = () => {
        reviewerForm.reset();
        [reviewerNameInput, reviewerEmailInput, reviewerExpertiseInput].forEach(input => {
            if (input) hideError(input, input.nextElementSibling);
        });
        updateReviewerSubmitButton();
    };
    
    const showReviewerSuccessMessage = () => {
        const reviewerFormSection = reviewerForm.closest('.form-section');
        reviewerFormSection.style.display = 'none';
        reviewerSuccessMessage.style.display = 'block';
    };
    
    // Manejo de envío del formulario de revisores
    const handleReviewerSubmit = async (event) => {
        event.preventDefault();
        
        const isNameValid = validateReviewerName();
        const isEmailValid = validateReviewerEmail();
        const isExpertiseValid = validateReviewerExpertise();
        
        if (!isNameValid || !isEmailValid || !isExpertiseValid) {
            return;
        }
        
        const newReviewer = {
            id: Date.now().toString(),
            name: reviewerNameInput.value.trim(),
            email: reviewerEmailInput.value.trim(),
            expertise: reviewerExpertiseInput.value,
            status: 'active',
            registeredDate: new Date().toLocaleDateString('es-ES'),
            timestamp: new Date().toISOString()
        };
        
        try {
            await storage.saveReviewer(newReviewer);
            reviewers.unshift(newReviewer);
            
            console.log('Revisor guardado:', newReviewer);
            filterReviewers();
            
            showReviewerSuccessMessage();
            clearReviewerForm();
        } catch (error) {
            console.error('Error al guardar revisor:', error);
            showErrorMessage('Error al guardar el revisor. Por favor, inténtelo nuevamente.');
        }
    };
    
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
            return false;
        } else if (value.length < 50) {
            summaryError.textContent = 'El resumen debe tener al menos 50 caracteres';
            showError(summaryInput, summaryError);
            return false;
        } else {
            hideError(summaryInput, summaryError);
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
            authorError.textContent = 'El autor debe tener al menos 3 caracteres';
            showError(authorInput, authorError);
            return false;
        } else {
            hideError(authorInput, authorError);
            return true;
        }
    };
    
    const validateEmail = () => {
        const value = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        formData.email = value;
        
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
        formData.document = file;
        
        if (!file) {
            showError(documentInput, documentError);
            return false;
        }
        
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        
        if (file.size > maxSize) {
            documentError.textContent = 'El documento no debe exceder los 10MB';
            showError(documentInput, documentError);
            return false;
        }
        
        if (!allowedTypes.includes(file.type)) {
            documentError.textContent = 'Formatos permitidos: PDF, DOC, DOCX, TXT';
            showError(documentInput, documentError);
            return false;
        }
        
        hideError(documentInput, documentError);
        return true;
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
        formData = {};
        [titleInput, summaryInput, authorInput, emailInput, documentInput].forEach(input => {
            if (input) hideError(input, input.nextElementSibling);
        });
        updateCharCount();
        updateSubmitButton();
    };
    
    const showSuccessMessage = () => {
        formSection.style.display = 'none';
        successMessage.style.display = 'block';
    };
    
    const showErrorMessage = (message) => {
        let errorContainer = document.getElementById('errorMessage');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.id = 'errorMessage';
            errorContainer.className = 'error-message-container';
            formSection.parentNode.insertBefore(errorContainer, formSection);
        }
        
        errorContainer.innerHTML = `
            <div class="error-content">
                <h4>Error</h4>
                <p>${message}</p>
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.remove()">Cerrar</button>
            </div>
        `;
        errorContainer.style.display = 'block';
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
        
        const newArticle = {
            id: currentEditingId || Date.now().toString(),
            title: formData.title,
            summary: formData.summary,
            author: formData.author,
            email: formData.email,
            keywords: keywordsInput.value.trim(),
            category: categorySelect.value,
            documentName: formData.document.name,
            documentSize: formData.document.size,
            date: new Date().toLocaleDateString('es-ES'),
            timestamp: new Date().toISOString(),
            status: 'pending',
            deviceId: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            syncStatus: networkMonitor.isOnline ? 'synced' : 'pending'
        };
        
        try {
            await storage.save(newArticle);
            articles.unshift(newArticle);
            
            console.log('Artículo guardado:', newArticle);
            filterArticles();
            
            showSuccessMessage();
            clearForm();
        } catch (error) {
            console.error('Error al guardar artículo:', error);
            showErrorMessage('Error al guardar el artículo. Por favor, inténtelo nuevamente.');
        }
    };
    
    // Cargar datos desde Firebase
    const loadArticlesFromStorage = async () => {
        try {
            articles = await storage.getAll();
            filterArticles();
        } catch (error) {
            console.error('Error cargando artículos:', error);
            articles = [];
            filterArticles();
        }
    };
    
    const loadReviewersFromStorage = async () => {
        try {
            reviewers = await storage.getAllReviewers();
            filterReviewers();
        } catch (error) {
            console.error('Error cargando revisores:', error);
            reviewers = [];
            filterReviewers();
        }
    };
    
    // Filtrar y renderizar artículos
    const filterArticles = () => {
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const categoryValue = categoryFilter ? categoryFilter.value : '';
        
        // Filtrar según el rol
        let articlesToFilter = articles;
        
        if (currentRole === 'reviewer') {
            articlesToFilter = articles.filter(article => 
                article.assignedReviewer && article.assignedReviewer !== ''
            );
            
            console.log('📋 Artículos con revisor asignado:', articlesToFilter.length);
            console.log('📋 Revisores disponibles:', reviewers.map(r => r.name));
        }
        
        filteredArticles = articlesToFilter.filter(article => {
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
            if (currentRole === 'reviewer') {
                articlesTable.innerHTML = `
                    <div class="no-articles">
                        <h3>📭 No tienes artículos asignados</h3>
                        <p>No hay artículos asignados para tu revisión en este momento.</p>
                        <p>El Editor te asignará artículos cuando estén listos para revisión.</p>
                    </div>
                `;
            } else if (currentRole === 'editor') {
                articlesTable.innerHTML = `
                    <div class="no-articles">
                        <h3>📂 No hay artículos disponibles</h3>
                        <p>No hay artículos registrados aún.</p>
                        <p>Los Autores deben registrar artículos primero para que puedas asignar revisores.</p>
                    </div>
                `;
            } else {
                articlesTable.innerHTML = `
                    <div class="no-articles">
                        <p>No hay artículos registrados aún. Registra tu primer artículo para comenzar.</p>
                    </div>
                `;
            }
            if (articlesCount) articlesCount.textContent = '0';
            return;
        }
        
        const articlesHTML = filteredArticles.map(article => {
            const isEditor = currentRole === 'editor';
            const isReviewer = currentRole === 'reviewer';
            const hasReviewer = article.assignedReviewer;
            
            return `
            <div class="article-item" data-id="${article.id}">
                <div class="article-header">
                    <h3 class="article-title">${article.title}</h3>
                    ${article.category ? `<span class="article-category">${getCategoryLabel(article.category)}</span>` : ''}
                    ${article.deviceId ? `<span class="device-badge">📱 ${article.deviceId === 'mobile' ? 'Celular' : 'Laptop'}</span>` : ''}
                    ${hasReviewer ? `<span class="reviewer-assigned">✅ Asignado a: ${hasReviewer}</span>` : ''}
                </div>
                <div class="article-meta">
                    <span class="article-author">Autor: ${article.author}</span>
                    <span class="article-date">${article.date}</span>
                    ${article.assignedDate ? `<span class="assigned-date">Asignado: ${article.assignedDate}</span>` : ''}
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
                    ${isEditor ? `
                        <button class="btn btn-small btn-info" onclick="assignReviewer('${article.id}')">
                            ${hasReviewer ? 'Cambiar Revisor' : 'Asignar Revisor'}
                        </button>
                    ` : ''}
                    ${isReviewer ? `
                        <button class="btn btn-small btn-success" onclick="reviewArticle('${article.id}')">
                            📝 Revisar Artículo
                        </button>
                        <button class="btn btn-small btn-warning" onclick="downloadDocument('${article.id}')">
                            📥 Descargar Documento
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
    
    // Funciones para revisores
    const filterReviewers = () => {
        const searchTerm = reviewerSearchInput ? reviewerSearchInput.value.toLowerCase() : '';
        const expertiseValue = expertiseFilter ? expertiseFilter.value : '';
        
        filteredReviewers = reviewers.filter(reviewer => {
            const matchesSearch = !searchTerm || 
                reviewer.name.toLowerCase().includes(searchTerm) ||
                reviewer.email.toLowerCase().includes(searchTerm) ||
                reviewer.expertise.toLowerCase().includes(searchTerm);
            
            const matchesExpertise = !expertiseValue || reviewer.expertise === expertiseValue;
            
            return matchesSearch && matchesExpertise;
        });
        
        renderReviewers();
    };
    
    const renderReviewers = () => {
        if (!reviewersTable) return;
        
        if (filteredReviewers.length === 0) {
            reviewersTable.innerHTML = `
                <div class="no-reviewers">
                    <p>No hay revisores registrados aún. Registra tu primer revisor para comenzar.</p>
                </div>
            `;
            if (reviewersCount) reviewersCount.textContent = '0';
            return;
        }
        
        const reviewersHTML = filteredReviewers.map(reviewer => `
            <div class="reviewer-item" data-id="${reviewer.id}">
                <div class="reviewer-header">
                    <h3 class="reviewer-name">${reviewer.name}</h3>
                    <span class="reviewer-expertise">${getExpertiseLabel(reviewer.expertise)}</span>
                    <span class="reviewer-status ${reviewer.status}">${reviewer.status === 'active' ? '✅ Activo' : '⏸ Inactivo'}</span>
                </div>
                <div class="reviewer-meta">
                    <span class="reviewer-email">📧 ${reviewer.email}</span>
                    <span class="reviewer-date">📅 ${reviewer.registeredDate}</span>
                </div>
                <div class="reviewer-actions">
                    <button class="btn btn-small btn-primary" onclick="editReviewer('${reviewer.id}')">Editar</button>
                    <button class="btn btn-small btn-secondary" onclick="deleteReviewer('${reviewer.id}')">Eliminar</button>
                </div>
            </div>
        `).join('');
        
        reviewersTable.innerHTML = reviewersHTML;
        if (reviewersCount) reviewersCount.textContent = filteredReviewers.length;
    };
    
    const getExpertiseLabel = (expertise) => {
        const labels = {
            'ciencias': 'Ciencias',
            'tecnologia': 'Tecnología',
            'educacion': 'Educación',
            'medicina': 'Medicina',
            'ingenieria': 'Ingeniería',
            'sociales': 'Ciencias Sociales',
            'artes': 'Artes y Humanidades',
            'multidisciplinario': 'Multidisciplinario'
        };
        return labels[expertise] || expertise;
    };
    
    // Configurar event listeners
    const setupEventListeners = () => {
        // Event listeners para formulario de artículos
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
        
        // Event listeners para formulario de revisores
        if (reviewerForm) {
            reviewerForm.addEventListener('submit', handleReviewerSubmit);
        }
        
        if (reviewerNameInput) {
            reviewerNameInput.addEventListener('input', () => {
                validateReviewerName();
                updateReviewerSubmitButton();
            });
        }
        
        if (reviewerEmailInput) {
            reviewerEmailInput.addEventListener('input', () => {
                validateReviewerEmail();
                updateReviewerSubmitButton();
            });
        }
        
        if (reviewerExpertiseInput) {
            reviewerExpertiseInput.addEventListener('change', () => {
                validateReviewerExpertise();
                updateReviewerSubmitButton();
            });
        }
        
        if (newReviewerBtn) {
            newReviewerBtn.addEventListener('click', () => {
                if (reviewerSuccessMessage) reviewerSuccessMessage.style.display = 'none';
                const reviewerFormSection = reviewerForm.closest('.form-section');
                if (reviewerFormSection) reviewerFormSection.style.display = 'block';
                clearReviewerForm();
            });
        }
        
        if (reviewerSearchInput) {
            reviewerSearchInput.addEventListener('input', filterReviewers);
        }
        
        if (expertiseFilter) {
            expertiseFilter.addEventListener('change', filterReviewers);
        }
    };
    
    // Función para asignar revisor
    const assignReviewer = (articleId) => {
        const article = articles.find(a => a.id === articleId);
        if (!article) return;
        
        // Crear modal de selección de revisores
        const modal = document.createElement('div');
        modal.className = 'reviewer-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeReviewerModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Asignar Revisor</h3>
                    <button class="modal-close" onclick="closeReviewerModal()">×</button>
                </div>
                <div class="modal-body">
                    <h4>Artículo: ${article.title}</h4>
                    <div class="reviewer-list">
                        ${reviewers.map(reviewer => `
                            <div class="reviewer-option">
                                <label>
                                    <input type="radio" name="selectedReviewer" value="${reviewer.name}">
                                    <span class="reviewer-info">
                                        <strong>${reviewer.name}</strong> - ${getExpertiseLabel(reviewer.expertise)}
                                        <br><small>${reviewer.email}</small>
                                    </span>
                                </label>
                            </div>
                        `).join('')}
                        ${reviewers.length === 0 ? '<p>No hay revisores registrados. Registra revisores primero.</p>' : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeReviewerModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="confirmAssignReviewer('${articleId}')" ${reviewers.length === 0 ? 'disabled' : ''}>
                        Asignar Revisor
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    };
    
    // Confirmar asignación de revisor
    const confirmAssignReviewer = async (articleId) => {
        const selectedReviewer = document.querySelector('input[name="selectedReviewer"]:checked');
        
        if (!selectedReviewer) {
            alert('Por favor, selecciona un revisor');
            return;
        }
        
        const article = articles.find(a => a.id === articleId);
        if (!article) return;
        
        article.assignedReviewer = selectedReviewer.value;
        article.assignedDate = new Date().toLocaleDateString('es-ES');
        
        try {
            await storage.save(article);
            console.log('Revisor asignado:', selectedReviewer.value, 'al artículo:', article.title);
            
            filterArticles();
            closeReviewerModal();
            
            showSuccessMessage(`Revisor ${selectedReviewer.value} asignado exitosamente al artículo "${article.title}"`);
        } catch (error) {
            console.error('Error asignando revisor:', error);
            alert('Error al asignar revisor. Por favor, inténtelo nuevamente.');
        }
    };
    
    // Cerrar modal de asignación
    const closeReviewerModal = () => {
        const modal = document.querySelector('.reviewer-modal');
        if (modal) {
            modal.remove();
        }
    };
    
    // Seleccionar rol
    const selectRole = (role) => {
        console.log('🎯 Seleccionando rol:', role);
        
        currentRole = role;
        localStorage.setItem('userRole', role);
        
        // Actualizar UI de botones
        const roleButtons = document.querySelectorAll('.role-card');
        roleButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.role === role) {
                btn.classList.add('active');
            }
        });
        
        // Mostrar contenido principal
        const roleSelector = document.getElementById('roleSelector');
        const mainContent = document.getElementById('mainContent');
        if (roleSelector) roleSelector.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        
        // Configurar interfaz según rol
        configureInterface(role);
        
        // Cargar datos después de un pequeño delay
        setTimeout(() => {
            initializeElements();
            setupEventListeners();
            updateSubmitButton();
            networkMonitor.updateStatus();
            loadArticlesFromStorage();
            loadReviewersFromStorage();
        }, 100);
    };
    
    // Configurar interfaz según rol
    const configureInterface = (role) => {
        console.log('⚙️ Configurando interfaz para rol:', role);
        
        const header = document.querySelector('.header p');
        const tabs = document.querySelector('.tabs');
        const articlesTab = document.getElementById('articlesTab');
        const reviewersTab = document.getElementById('reviewersTab');
        
        switch(role) {
            case 'author':
                if (header) header.textContent = 'Panel del Autor';
                if (tabs) tabs.style.display = 'none';
                if (reviewersTab) reviewersTab.style.display = 'none';
                if (articlesTab) articlesTab.style.display = 'block';
                const formSection = document.querySelector('.form-section');
                if (formSection) {
                    formSection.style.display = 'block';
                }
                const newArticleBtn = document.getElementById('newArticleBtn');
                if (newArticleBtn) {
                    newArticleBtn.style.display = 'block';
                }
                break;
                
            case 'editor':
                if (header) header.textContent = 'Panel del Editor';
                if (tabs) tabs.style.display = 'flex';
                if (articlesTab) articlesTab.style.display = 'block';
                if (reviewersTab) reviewersTab.style.display = 'block';
                const formSectionEditor = document.querySelector('.form-section');
                if (formSectionEditor) {
                    formSectionEditor.style.display = 'none';
                }
                const newArticleBtnEditor = document.getElementById('newArticleBtn');
                if (newArticleBtnEditor) {
                    newArticleBtnEditor.style.display = 'none';
                }
                break;
                
            case 'reviewer':
                if (header) header.textContent = 'Panel del Revisor';
                if (tabs) tabs.style.display = 'none';
                if (reviewersTab) reviewersTab.style.display = 'none';
                if (articlesTab) {
                    articlesTab.style.display = 'block';
                    const formSection = document.querySelector('.form-section');
                    if (formSection) {
                        formSection.style.display = 'none';
                    }
                    const newArticleBtn = document.getElementById('newArticleBtn');
                    if (newArticleBtn) {
                        newArticleBtn.style.display = 'none';
                    }
                    if (articlesTable) {
                        articlesTable.innerHTML = `
                            <div class="reviewer-welcome">
                                <h3>📋 Artículos Asignados para Revisión</h3>
                                <p>Aquí se muestran todos los artículos con revisor asignado.</p>
                            </div>
                        `;
                    }
                }
                break;
        }
        
        console.log('✅ Interfaz configurada para:', role);
    };
    
    // Inicialización principal
    const init = async () => {
        console.log('🚀 Inicializando aplicación...');
        
        // Test de conexión Firebase
        if (typeof firebase !== 'undefined') {
            console.log('🔥 Firebase disponible');
            try {
                const testDoc = await db.collection('test').doc('connection').set({
                    timestamp: new Date(),
                    status: 'connected'
                });
                console.log('✅ Firebase conectado exitosamente');
            } catch (error) {
                console.error('❌ Error Firebase:', error);
            }
        } else {
            console.log('⚠️ Firebase no disponible, usando IndexedDB local');
        }
        
        // Test básico de botones
        console.log('🔍 Buscando botones de rol...');
        const roleButtons = document.querySelectorAll('.role-card');
        console.log('📊 Botones encontrados:', roleButtons.length);
        
        if (roleButtons.length === 0) {
            console.error('❌ No se encontraron botones con clase .role-card');
            return;
        }
        
        // Agregar event listeners manualmente
        roleButtons.forEach((btn, index) => {
            console.log(`🔧 Configurando botón ${index}:`, btn.querySelector('h3').textContent, btn.dataset.role);
            
            // Remover listeners anteriores
            btn.replaceWith(btn.cloneNode(true));
            
            // Agregar nuevo listener
            const newBtn = document.querySelectorAll('.role-card')[index];
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🎯 Botón presionado:', newBtn.dataset.role);
                selectRole(newBtn.dataset.role);
            });
        });
        
        console.log('✅ Botones configurados');
        
        // NO cargar rol guardado automáticamente - esperar a que el usuario presione un botón
        console.log('� Esperando que el usuario seleccione un rol...');
    };
    
    // Inicializar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', init);
    
    // Funciones para el Revisor
    const reviewArticle = (articleId) => {
        const article = articles.find(a => a.id === articleId);
        if (article) {
            showSuccessMessage(`Abriendo artículo para revisión: ${article.title}`);
            console.log('Revisando artículo:', article);
        }
    };
    
    const downloadDocument = (articleId) => {
        const article = articles.find(a => a.id === articleId);
        if (article && article.documentName) {
            showSuccessMessage(`Descargando documento: ${article.documentName}`);
            console.log('Descargando documento:', article.documentName);
        }
    };
    
    // Exponer funciones globalmente
    window.assignReviewer = assignReviewer;
    window.confirmAssignReviewer = confirmAssignReviewer;
    window.closeReviewerModal = closeReviewerModal;
    window.reviewArticle = reviewArticle;
    window.downloadDocument = downloadDocument;
    window.editReviewer = (id) => {
        console.log('Editando revisor:', id);
    };
    window.deleteReviewer = (id) => {
        if (confirm('¿Estás seguro de que deseas eliminar este revisor?')) {
            console.log('Eliminando revisor:', id);
            reviewers = reviewers.filter(r => r.id !== id);
            filterReviewers();
        }
    };
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
        }
    };
    
    return {
        init,
        submitArticle: handleArticleSubmit,
        clearForm,
        filterArticles
    };
})();
