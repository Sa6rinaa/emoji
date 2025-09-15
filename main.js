// ========================================
// SYSTÈME DE RÉACTIONS (LIKES) 
// ========================================

// Structure de données pour les réactions
// Table Supabase "reactions" requise avec colonnes :
// - id (uuid, primary key)
// - mood_id (uuid, foreign key vers humeur.id)
// - user_name (text)
// - reaction_type (text, ex: '👍', '❤️', '😊')
// - created_at (timestamp)

let reactions = []; // Cache local des réactions
let currentUserName = ''; // Nom de l'utilisateur actuel pour éviter les doublons

// Types de réactions disponibles
const REACTION_TYPES = {
    LIKE: '👍',
    LOVE: '❤️',
    LAUGH: '😂',
    WOW: '😮',
    CELEBRATE: '🎉'
};

// ========================================
// GESTION DES RÉACTIONS
// ========================================

/**
 * Ajouter ou supprimer une réaction à une humeur
 * @param {string} moodId - ID de l'humeur
 * @param {string} reactionType - Type de réaction (emoji)
 * @param {string} userName - Nom de l'utilisateur qui réagit
 */
async function toggleReaction(moodId, reactionType = REACTION_TYPES.LIKE, userName = null) {
    if (!supabase || !isConnected) {
        console.error('❌ Supabase non connecté pour les réactions');
        showNotification('Erreur de connexion', 'error');
        return false;
    }

    if (!moodId) {
        console.error('❌ ID de l\'humeur manquant');
        return false;
    }

    // Utiliser le nom de l'utilisateur actuel ou demander
    if (!userName) {
        userName = getCurrentUserName();
        if (!userName) {
            userName = prompt('Quel est ton prénom pour réagir ?');
            if (!userName || userName.trim().length < 2) {
                showNotification('Prénom requis pour réagir', 'warning');
                return false;
            }
            userName = userName.trim();
            setCurrentUserName(userName);
        }
    }

    try {
        console.log(`🎯 Toggle réaction: ${reactionType} pour humeur ${moodId} par ${userName}`);

        // Vérifier si l'utilisateur a déjà cette réaction
        const existingReaction = await findExistingReaction(moodId, userName, reactionType);

        if (existingReaction) {
            // Supprimer la réaction existante
            const success = await removeReaction(existingReaction.id);
            if (success) {
                showNotification('Réaction supprimée', 'success');
                return true;
            }
        } else {
            // Ajouter une nouvelle réaction
            const success = await addReaction(moodId, reactionType, userName);
            if (success) {
                showNotification(`Réaction ${reactionType} ajoutée !`, 'success');
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error('❌ Erreur toggle réaction:', error);
        showNotification('Erreur lors de la réaction', 'error');
        return false;
    }
}

/**
 * Ajouter une réaction
 */
async function addReaction(moodId, reactionType, userName) {
    try {
        const reactionData = {
            mood_id: moodId,
            user_name: userName,
            reaction_type: reactionType
        };

        const { data, error } = await supabase
            .from('reactions')
            .insert([reactionData])
            .select();

        if (error) {
            throw error;
        }

        console.log('✅ Réaction ajoutée:', data[0]);
        
        // Mettre à jour le cache local
        if (data && data[0]) {
            reactions.push(data[0]);
            updateMoodListWithReactions();
        }

        return true;

    } catch (error) {
        console.error('❌ Erreur ajout réaction:', error);
        throw error;
    }
}

/**
 * Supprimer une réaction
 */
async function removeReaction(reactionId) {
    try {
        const { error } = await supabase
            .from('reactions')
            .delete()
            .eq('id', reactionId);

        if (error) {
            throw error;
        }

        console.log('✅ Réaction supprimée:', reactionId);
        
        // Mettre à jour le cache local
        reactions = reactions.filter(r => r.id !== reactionId);
        updateMoodListWithReactions();

        return true;

    } catch (error) {
        console.error('❌ Erreur suppression réaction:', error);
        throw error;
    }
}

/**
 * Trouver une réaction existante de l'utilisateur
 */
async function findExistingReaction(moodId, userName, reactionType) {
    try {
        const { data, error } = await supabase
            .from('reactions')
            .select('*')
            .eq('mood_id', moodId)
            .eq('user_name', userName)
            .eq('reaction_type', reactionType)
            .limit(1);

        if (error) {
            throw error;
        }

        return data && data.length > 0 ? data[0] : null;

    } catch (error) {
        console.error('❌ Erreur recherche réaction existante:', error);
        return null;
    }
}

/**
 * Charger toutes les réactions depuis Supabase
 */
async function loadReactionsFromSupabase() {
    if (!supabase || !isConnected) {
        console.log('⏭️ Chargement réactions ignoré - Supabase non connecté');
        return;
    }

    try {
        console.log('📥 Chargement des réactions depuis Supabase...');
        
        const { data, error } = await supabase
            .from('reactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        reactions = data || [];
        console.log(`👍 ${reactions.length} réactions chargées`);
        
        // Mettre à jour l'affichage avec les réactions
        updateMoodListWithReactions();

    } catch (error) {
        console.error('❌ Erreur chargement réactions:', error);
    }
}

/**
 * Obtenir les réactions pour une humeur spécifique
 */
function getReactionsForMood(moodId) {
    return reactions.filter(r => r.mood_id === moodId);
}

/**
 * Compter les réactions par type pour une humeur
 */
function countReactionsByType(moodId) {
    const moodReactions = getReactionsForMood(moodId);
    const counts = {};
    
    moodReactions.forEach(reaction => {
        counts[reaction.reaction_type] = (counts[reaction.reaction_type] || 0) + 1;
    });
    
    return counts;
}

/**
 * Vérifier si l'utilisateur actuel a réagi à une humeur
 */
function hasUserReacted(moodId, userName, reactionType) {
    if (!userName) userName = getCurrentUserName();
    if (!userName) return false;
    
    return reactions.some(r => 
        r.mood_id === moodId && 
        r.user_name === userName && 
        r.reaction_type === reactionType
    );
}

// ========================================
// GESTION UTILISATEUR ACTUEL
// ========================================

function getCurrentUserName() {
    // Essayer de récupérer depuis le stockage local ou variable globale
    if (currentUserName) return currentUserName;
    
    // Essayer de récupérer depuis le formulaire s'il est rempli
    const nameInput = document.getElementById('studentName');
    if (nameInput && nameInput.value.trim()) {
        currentUserName = nameInput.value.trim();
        return currentUserName;
    }
    
    return null;
}

function setCurrentUserName(userName) {
    currentUserName = userName;
    console.log('👤 Utilisateur actuel défini:', userName);
}

// ========================================
// INTERFACE UTILISATEUR DES RÉACTIONS
// ========================================

/**
 * Créer les boutons de réaction pour une humeur
 */
function createReactionButtons(moodId) {
    const currentUser = getCurrentUserName();
    const reactionCounts = countReactionsByType(moodId);
    
    return Object.entries(REACTION_TYPES).map(([key, emoji]) => {
        const count = reactionCounts[emoji] || 0;
        const hasReacted = currentUser ? hasUserReacted(moodId, currentUser, emoji) : false;
        const activeClass = hasReacted ? 'reaction-active' : '';
        
        return `
            <button class="reaction-btn ${activeClass}" 
                    onclick="handleReactionClick('${moodId}', '${emoji}')"
                    title="Réagir avec ${emoji}">
                <span class="reaction-emoji">${emoji}</span>
                ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
            </button>
        `;
    }).join('');
}

/**
 * Gestionnaire de clic sur les boutons de réaction
 */
window.handleReactionClick = async function(moodId, reactionType) {
    console.log(`🎯 Clic réaction: ${reactionType} pour humeur ${moodId}`);
    
    // Désactiver temporairement le bouton
    const button = event.target.closest('.reaction-btn');
    if (button) {
        button.disabled = true;
        button.style.opacity = '0.6';
    }
    
    try {
        await toggleReaction(moodId, reactionType);
    } finally {
        // Réactiver le bouton
        if (button) {
            button.disabled = false;
            button.style.opacity = '1';
        }
    }
};

/**
 * Afficher les détails des réactions (qui a réagi)
 */
function showReactionDetails(moodId) {
    const moodReactions = getReactionsForMood(moodId);
    
    if (moodReactions.length === 0) {
        showNotification('Aucune réaction pour le moment', 'info');
        return;
    }
    
    // Grouper par type de réaction
    const grouped = {};
    moodReactions.forEach(reaction => {
        if (!grouped[reaction.reaction_type]) {
            grouped[reaction.reaction_type] = [];
        }
        grouped[reaction.reaction_type].push(reaction.user_name);
    });
    
    let detailsHTML = '<div class="reaction-details"><h4>👥 Qui a réagi :</h4>';
    
    Object.entries(grouped).forEach(([emoji, users]) => {
        detailsHTML += `
            <div class="reaction-group">
                <span class="reaction-emoji-big">${emoji}</span>
                <span class="reaction-users">${users.join(', ')}</span>
            </div>
        `;
    });
    
    detailsHTML += '</div>';
    
    showModal('Détails des réactions', detailsHTML);
}

// ========================================
// MISE À JOUR DE L'AFFICHAGE AVEC RÉACTIONS
// ========================================

/**
 * Version modifiée de updateMoodList() avec support des réactions
 */
function updateMoodListWithReactions() {
    const listContainer = document.getElementById('moodList');
    if (!listContainer) return;

    if (humeurs.length === 0) {
        listContainer.innerHTML = `
            <div class="loading">
                <p>🤖 En attente des premiers codes humeur...</p>
                <p style="font-size: 0.9em; margin-top: 10px; color: #666;">
                    Partage ton humeur pour commencer !
                </p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = humeurs.map(humeur => {
        const codeSnippet = generateCodeSnippet(humeur);
        const timeDisplay = formatTime(humeur.created_at);
        const isRecent = new Date() - new Date(humeur.created_at) < 60000;
        const reactionButtons = createReactionButtons(humeur.id);
        const totalReactions = getReactionsForMood(humeur.id).length;
        
        return `
            <div class="mood-item ${isRecent ? 'new-post' : ''}">
                <div class="mood-header">
                    <div class="mood-user">
                        <span class="mood-name">${escapeHtml(humeur.nom)}</span>
                        <span class="mood-emoji">${humeur.emoji}</span>
                        <span class="mood-lang">${humeur.langage_prefere}</span>
                    </div>
                    <span class="mood-time">${timeDisplay}</span>
                </div>
                <div class="mood-content">
                    <div class="mood-code">${codeSnippet}</div>
                    ${humeur.commentaire ? `<div class="mood-comment">"${escapeHtml(humeur.commentaire)}"</div>` : ''}
                    <div class="mood-tags">
                        <span class="tag">${formatPreference(humeur.autre_preference)}</span>
                    </div>
                </div>
                <div class="mood-reactions">
                    <div class="reaction-buttons">
                        ${reactionButtons}
                    </div>
                    ${totalReactions > 0 ? `
                        <div class="reaction-summary" onclick="showReactionDetails('${humeur.id}')" style="cursor: pointer;">
                            <span class="reaction-total">${totalReactions} réaction${totalReactions > 1 ? 's' : ''}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// TEMPS RÉEL POUR LES RÉACTIONS
// ========================================

/**
 * Configuration du temps réel pour les réactions
 */
function setupReactionsRealtime() {
    if (!supabase) return;

    console.log('📡 Configuration temps réel pour les réactions...');

    const reactionsChannel = supabase
        .channel('reactions_realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'reactions' },
            (payload) => {
                console.log('🔄 Changement réaction temps réel:', payload.eventType);

                if (payload.eventType === 'INSERT') {
                    reactions.push(payload.new);
                    updateMoodListWithReactions();
                    
                    // Animation pour la nouvelle réaction
                    setTimeout(() => {
                        const reactionBtn = document.querySelector(`[onclick*="${payload.new.mood_id}"][onclick*="${payload.new.reaction_type}"]`);
                        if (reactionBtn) {
                            reactionBtn.style.animation = 'pulse 0.5s ease';
                            setTimeout(() => {
                                reactionBtn.style.animation = '';
                            }, 500);
                        }
                    }, 100);
                } else if (payload.eventType === 'DELETE') {
                    reactions = reactions.filter(r => r.id !== payload.old.id);
                    updateMoodListWithReactions();
                }
            }
        )
        .subscribe((status) => {
            console.log('📡 Statut temps réel réactions:', status);
        });

    return reactionsChannel;
}

// ========================================
// STYLES CSS POUR LES RÉACTIONS
// ========================================

const reactionStyles = `
<style>
.mood-reactions {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #f0f0f0;
}

.reaction-buttons {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.reaction-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    min-height: 32px;
}

.reaction-btn:hover {
    background: #e9ecef;
    transform: scale(1.05);
}

.reaction-btn.reaction-active {
    background: #e3f2fd;
    border-color: #2196f3;
    color: #1976d2;
}

.reaction-emoji {
    font-size: 16px;
}

.reaction-count {
    font-weight: 600;
    font-size: 12px;
    color: #666;
}

.reaction-btn.reaction-active .reaction-count {
    color: #1976d2;
}

.reaction-summary {
    font-size: 12px;
    color: #666;
    font-style: italic;
}

.reaction-summary:hover {
    color: #1976d2;
    text-decoration: underline;
}

.reaction-details {
    max-width: 300px;
}

.reaction-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 8px;
}

.reaction-emoji-big {
    font-size: 20px;
}

.reaction-users {
    font-size: 14px;
    color: #333;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}

.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
}

.notification.success { background: #4caf50; }
.notification.error { background: #f44336; }
.notification.warning { background: #ff9800; }
.notification.info { background: #2196f3; }

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
</style>
`;

// ========================================
// UTILITAIRES
// ========================================

/**
 * Afficher une notification temporaire
 */
function showNotification(message, type = 'info', duration = 3000) {
    // Supprimer les notifications existantes
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}

/**
 * Afficher une modal
 */
function showModal(title, content) {
    // Supprimer les modals existantes
    document.querySelectorAll('.reaction-modal').forEach(m => m.remove());
    
    const modal = document.createElement('div');
    modal.className = 'reaction-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="
            background: white; padding: 20px; border-radius: 12px; 
            max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
        ">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0;">${title}</h3>
                <button onclick="this.closest('.reaction-modal').remove()" style="
                    background: none; border: none; font-size: 24px; cursor: pointer;
                ">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// ========================================
// INTÉGRATION AVEC L'APPLICATION PRINCIPALE
// ========================================

/**
 * Initialiser le système de réactions
 * À appeler après l'initialisation de Supabase
 */
async function initReactionSystem() {
    console.log('👍 Initialisation du système de réactions...');
    
    try {
        // Injecter les styles
        if (!document.querySelector('#reaction-styles')) {
            const styleElement = document.createElement('div');
            styleElement.id = 'reaction-styles';
            styleElement.innerHTML = reactionStyles;
            document.head.appendChild(styleElement);
        }
        
        // Charger les réactions existantes
        await loadReactionsFromSupabase();
        
        // Configurer le temps réel pour les réactions
        const reactionsChannel = setupReactionsRealtime();
        
        // Modifier la fonction updateDisplay pour inclure les réactions
        const originalUpdateDisplay = window.updateDisplay;
        window.updateDisplay = function() {
            originalUpdateDisplay();
            updateMoodListWithReactions();
        };
        
        // Écouter les changements du nom d'utilisateur dans le formulaire
        const nameInput = document.getElementById('studentName');
        if (nameInput) {
            nameInput.addEventListener('blur', (e) => {
                if (e.target.value.trim()) {
                    setCurrentUserName(e.target.value.trim());
                }
            });
        }
        
        console.log('✅ Système de réactions initialisé avec succès');
        return true;
        
    } catch (error) {
        console.error('❌ Erreur initialisation système de réactions:', error);
        return false;
    }
}

// ========================================
// EXPORT DES FONCTIONS PRINCIPALES
// ========================================

// Rendre les fonctions disponibles globalement
window.toggleReaction = toggleReaction;
window.showReactionDetails = showReactionDetails;
window.initReactionSystem = initReactionSystem;

console.log('✅ Système de réactions chargé - Prêt pour l\'intégration');