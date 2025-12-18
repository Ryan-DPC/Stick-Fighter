export class MenuManager {
    constructor(game) {
        this.game = game;
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.howToPlayScreen = document.getElementById('how-to-play-screen');
        this.chatContainer = document.getElementById('chat-container');
        this.announcement = document.getElementById('round-announcement');
        
        this.initButtons();
    }

    initButtons() {
        const localBtn = document.getElementById('local-btn');
        const onlineBtn = document.getElementById('online-btn');
        const howToPlayBtn = document.getElementById('how-to-play-btn');
        const backBtn = document.getElementById('back-to-menu');

        localBtn.addEventListener('click', () => this.game.startLocalGame());
        onlineBtn.addEventListener('click', () => this.game.startOnlineGame());
        howToPlayBtn.addEventListener('click', () => this.showHowToPlay());
        backBtn.addEventListener('click', () => this.showMenu());
    }

    showMenu() {
        // Reset styles
        this.menuScreen.style.display = '';
        this.gameScreen.style.display = '';
        this.howToPlayScreen.style.display = '';

        this.menuScreen.classList.add('active');
        this.howToPlayScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        
        // Ensure chat is hidden in menu
        this.chatContainer.style.display = 'none';
        
        this.game.gameActive = false;
    }

    showHowToPlay() {
        this.menuScreen.classList.remove('active');
        this.howToPlayScreen.classList.add('active');
    }

    startGameUI(isOnline) {
        // Force hide menu
        this.menuScreen.classList.remove('active');
        this.menuScreen.style.display = 'none';

        // Show game
        this.gameScreen.classList.add('active');
        this.gameScreen.style.display = 'flex';

        // Toggle chat based on mode
        this.chatContainer.style.display = isOnline ? 'flex' : 'none';
    }

    showAnnouncement(text) {
        this.announcement.textContent = text;
        this.announcement.classList.add('show');
        setTimeout(() => this.announcement.classList.remove('show'), 2000);
    }
    
    updateScores(p1Score, p2Score) {
        document.getElementById('score-p1').textContent = p1Score;
        document.getElementById('score-p2').textContent = p2Score;
    }

    addChatMessage(sender, message) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const msgElement = document.createElement('div');
            msgElement.className = 'chat-msg';
            msgElement.innerHTML = `<span class="chat-sender">${sender}:</span> ${message}`;
            chatMessages.appendChild(msgElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}
