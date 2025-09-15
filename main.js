// ========================================
// SYSTÈME DE NOTIFICATIONS PUSH
// ========================================

console.log('🔔 Chargement du système de notifications push...');

// Variables globales pour les notifications
let notificationPermission = 'default';
let notificationSettings = {
    enabled: false,
    newMoods: true,
    reactions: true,
    milestones: true,
    sound: true
};

// Compteurs pour les notifications
let notificationStats = {
    sent: 0,
    clicked: 0,
    lastSent: null
};

// ========================================
// CONFIGURATION ET PERMISSIONS
// ========================================

/**
 * Demander la permission pour les notifications et configurer le système
 */
async function setupNotifications() {
    console.log('🔔 Configuration du système de notifications...');
    
    try {
        // Vérifier le support des notifications
        if (!('Notification' in window)) {
            console.warn('⚠️ Les notifications ne sont pas supportées par ce navigateur');
            showNotificationStatus('Notifications non supportées', 'error');
            return false;
        }

        // Vérifier la permission actuelle
        notificationPermission = Notification.permission;
        console.log('🔍 Permission actuelle:', notificationPermission);

        if (notificationPermission === 'default') {
            // Demander la permission
            console.log('📝 Demande de permission...');
            showPermissionDialog();
            
        } else if (notificationPermission === 'granted') {
            // Permission déjà accordée
            console.log('✅ Permission déjà accordée');
            notificationSettings.enabled = true;
            showNotificationStatus('Notifications activées', 'success');
            setupNotificationUI();
            
        } else if (notificationPermission === 'denied') {
            // Permission refusée
            console.log('❌ Permission refusée');
            showNotificationStatus('Notifications bloquées - Débloquer dans les paramètres du navigateur', 'error');
            setupNotificationUI();
        }

        // Initialiser l'interface des paramètres
        initNotificationSettings();
        
        return notificationPermission === 'granted';
        
    } catch (error) {
        console.error('❌ Erreur configuration notifications:', error);
        showNotificationStatus('Erreur de configuration des notifications', 'error');
        return false;
    }
}

/**
 * Afficher la boîte de dialogue pour demander la permission
 */
function showPermissionDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'notification-permission-dialog';
    dialog.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); z-index: 10000; display: flex;
        align-items: center; justify-content: center; animation: fadeIn 0.3s ease;
    `;
    
    dialog.innerHTML = `
        <div class="permission-content" style="
            background: white; padding: 30px; border-radius: 15px; max-width: 500px; 
            width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        ">
            <div class="permission-icon" style="font-size: 48px; margin-bottom: 20px;">🔔</div>
            <h3 style="margin: 0 0 15px 0; color: #333;">Activer les notifications ?</h3>
            <p style="color: #666; margin-bottom: 25px; line-height: 1.5;">
                Recevez des notifications pour :<br>
                • 🎭 Nouvelles humeurs partagées<br>
                • 👍 Réactions sur vos humeurs<br>
                • 🎯 Étapes importantes atteintes
            </p>
            <div class="permission-buttons" style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="requestNotificationPermission()" style="
                    background: #4caf50; color: white; border: none; padding: 12px 24px;
                    border-radius: 25px; cursor: pointer; font-weight: 500; font-size: 16px;
                    transition: all 0.2s ease;
                ">✅ Activer</button>
                <button onclick="closePermissionDialog(