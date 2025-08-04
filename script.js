class YapppoAI {
    constructor() {
        this.apiKey = null;
        this.personalityData = null;
        this.ttsEnabled = false;
        this.isProcessing = false;
        this.chatHistory = [];
        
        this.init();
    }

    async init() {
        // Get API key from environment or prompt user
        this.apiKey = await this.getApiKey();
        
        // Load saved personality data
        this.loadPersonalityData();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // If personality data exists, skip to chat
        if (this.personalityData) {
            this.showChat();
            this.initializeChat();
        }
    }

    async getApiKey() {
        // Check localStorage for saved key first
        const savedKey = localStorage.getItem('openrouter_api_key');
        if (savedKey) {
            // Clear localStorage if key seems corrupted (too short)
            if (savedKey.length < 50) {
                localStorage.removeItem('openrouter_api_key');
            } else {
                return savedKey;
            }
        }
        
        // Try to get API key from server environment
        try {
            const response = await fetch('https://yapppo-backend.onrender.com');
            if (response.ok) {
                const config = await response.json();
                if (config.openrouter_api_key) {
                    // Save to localStorage for future use
                    localStorage.setItem('openrouter_api_key', config.openrouter_api_key);
                    return config.openrouter_api_key;
                }
            }
        } catch (error) {
            console.log('Could not fetch API key from server, will prompt user');
        }
        
        // Prompt user for API key as fallback
        const userKey = prompt(
            'Please enter your OpenRouter API key:\n\nYou can get one free at https://openrouter.ai/\n\n(This will be saved locally in your browser)'
        );
        
        if (userKey) {
            localStorage.setItem('openrouter_api_key', userKey.trim());
            return userKey.trim();
        }
        
        return null;
    }

    loadPersonalityData() {
        const saved = localStorage.getItem('yapppo_personality');
        if (saved) {
            try {
                this.personalityData = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved personality data:', e);
                localStorage.removeItem('yapppo_personality');
            }
        }
    }

    savePersonalityData(data) {
        this.personalityData = data;
        localStorage.setItem('yapppo_personality', JSON.stringify(data));
    }

    setupEventListeners() {
        // Questionnaire form submission
        const form = document.getElementById('personality-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Chat input handling
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (chatInput && sendBtn) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            chatInput.addEventListener('input', () => {
                const hasText = chatInput.value.trim().length > 0;
                sendBtn.disabled = !hasText || this.isProcessing;
            });
            
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // TTS toggle
        const ttsBtn = document.getElementById('tts-toggle');
        if (ttsBtn) {
            ttsBtn.addEventListener('click', () => this.toggleTTS());
        }

        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetApp());
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.apiKey) {
            alert('API key is required to continue. Please refresh and enter your OpenRouter API key.');
            return;
        }

        const submitBtn = e.target.querySelector('.primary-button');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';

        try {
            // Collect form data
            const formData = new FormData(e.target);
            const answers = {};
            
            // Process form inputs into structured data  
            for (let [key, value] of formData.entries()) {
                if (value.trim()) {
                    answers[key] = value.trim();
                }
            }
            
            // Validate all 4 questions are answered
            const requiredFields = ['q1', 'q2', 'q3', 'q4'];
            const missingFields = requiredFields.filter(field => !answers[field]);
            
            if (missingFields.length > 0) {
                throw new Error('Please answer all questions before continuing.');
            }

            // Store the personality data
            this.personalityData = answers;
            localStorage.setItem('yapppo_personality_data', JSON.stringify(answers));

            // Transition to chat
            setTimeout(() => {
                this.showChat();
                this.initializeChat();
            }, 1000);

        } catch (error) {
            console.error('Error processing form:', error);
            alert('There was an error processing your responses. Please try again.');
            
            // Reset button state
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    }

    showChat() {
        const questionnaire = document.getElementById('questionnaire');
        const chat = document.getElementById('chat');
        
        questionnaire.style.display = 'none';
        chat.style.display = 'block';
        
        // Enable chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    async initializeChat() {
        // Add welcome message from Yapppo
        await this.addMessage('ai', this.generateWelcomeMessage());
        
        // Speak welcome message if TTS is enabled
        if (this.ttsEnabled) {
            this.speak(this.generateWelcomeMessage());
        }
    }

    generateWelcomeMessage() {
        // Generate a simple, natural welcome message
        return "Hey! I'm Yapppo and I've learned your communication style. Ready to chat? I'll respond in a way that matches how you naturally talk!";
    }



    generatePersonalityPrompt() {
        if (!this.personalityData) {
            return "You are a helpful AI assistant.";
        }

        // Analyze the personality traits from the questionnaire responses
        const traits = this.analyzePersonalityTraits();

        return `You are Yapppo AI, a helpful assistant that naturally adapts to match the user's communication style. Based on their personality assessment, here's how to communicate with them:

Personality Profile:
${traits.join(', ')}

COMMUNICATION GUIDELINES:
- Match their emotional intelligence style: ${this.getEmotionalStyle()}
- Adapt to their decision-making approach: ${this.getDecisionStyle()}
- Use their preferred communication tone: ${this.getCommunicationStyle()}
- Respect their energy/social preferences: ${this.getEnergyStyle()}

CRITICAL INSTRUCTIONS:
- Naturally adapt to their personality without being obvious about it
- Be genuinely helpful while communicating in a way that resonates with them
- Don't mention this personality analysis or reference the questionnaire
- You are an AI assistant helping them, not copying their exact behavior
- Respond as if this communication style is simply how you naturally talk
- Focus on being helpful while matching their communication comfort zone

Your goal: Be a helpful AI that communicates in a way that feels natural and comfortable to this specific user.`;
    }

    analyzePersonalityTraits() {
        const traits = [];
        
        // Emotional intelligence analysis (Question 1)
        if (this.personalityData.q1 === 'listen') {
            traits.push("empathetic listener");
        } else if (this.personalityData.q1 === 'share') {
            traits.push("warm connector");
        } else if (this.personalityData.q1 === 'advice') {
            traits.push("solution-focused helper");
        }
        
        // Decision-making style analysis (Question 2) 
        if (this.personalityData.q2 === 'research') {
            traits.push("thoughtful analyzer");
        } else if (this.personalityData.q2 === 'intuition') {
            traits.push("intuitive decision-maker");
        } else if (this.personalityData.q2 === 'collaborate') {
            traits.push("collaborative thinker");
        }
        
        // Communication preference analysis (Question 3)
        if (this.personalityData.q3 === 'direct') {
            traits.push("values authenticity");
        } else if (this.personalityData.q3 === 'gentle') {
            traits.push("considerate communicator");
        } else if (this.personalityData.q3 === 'humor') {
            traits.push("uses humor to connect");
        }
        
        // Energy and social style analysis (Question 4)
        if (this.personalityData.q4 === 'quiet') {
            traits.push("enjoys peaceful moments");
        } else if (this.personalityData.q4 === 'close') {
            traits.push("values deep connections");
        } else if (this.personalityData.q4 === 'social') {
            traits.push("energized by social interaction");
        }
        
        return traits;
    }

    getEmotionalStyle() {
        switch (this.personalityData.q1) {
            case 'listen': return "Show genuine interest and ask thoughtful questions";
            case 'share': return "Connect through shared experiences and understanding";
            case 'advice': return "Focus on practical solutions and actionable help";
            default: return "Be supportive and understanding";
        }
    }

    getDecisionStyle() {
        switch (this.personalityData.q2) {
            case 'research': return "Provide thorough information and consider multiple angles";
            case 'intuition': return "Trust gut instincts and be confident in recommendations";
            case 'collaborate': return "Consider different perspectives and validate ideas";
            default: return "Be balanced in approach";
        }
    }

    getCommunicationStyle() {
        switch (this.personalityData.q3) {
            case 'direct': return "Be straightforward and honest, even about difficult topics";
            case 'gentle': return "Choose words carefully and communicate with sensitivity";
            case 'humor': return "Use light humor and keep things upbeat when appropriate";
            default: return "Be clear and respectful";
        }
    }

    getEnergyStyle() {
        switch (this.personalityData.q4) {
            case 'quiet': return "Keep a calm, peaceful energy in responses";
            case 'close': return "Focus on meaningful, deeper conversations";
            case 'social': return "Bring positive energy and enthusiasm";
            default: return "Match their energy level appropriately";
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message || this.isProcessing) return;

        // Clear input and disable controls
        chatInput.value = '';
        this.setProcessingState(true);

        // Add user message
        this.addMessage('user', message);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Get AI response
            const response = await this.getAIResponse(message);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add AI response
            this.addMessage('ai', response);
            
            // Speak response if TTS is enabled
            if (this.ttsEnabled) {
                this.speak(response);
            }

        } catch (error) {
            console.error('Error getting AI response:', error);
            this.hideTypingIndicator();
            
            let errorMessage = "Sorry, I'm having trouble connecting right now. ";
            
            if (error.message.includes('API key')) {
                errorMessage += "It looks like there might be an issue with the API key. Please check your OpenRouter API key and try again.";
            } else if (error.message.includes('network')) {
                errorMessage += "Please check your internet connection and try again.";
            } else {
                errorMessage += "Please try again in a moment.";
            }
            
            this.addMessage('ai', errorMessage);
        }

        this.setProcessingState(false);
    }

    async getAIResponse(userMessage) {
        if (!this.apiKey) {
            throw new Error('API key not available');
        }

        // Build conversation history
        const messages = [
            {
                role: 'system',
                content: this.generatePersonalityPrompt()
            },
            ...this.chatHistory,
            {
                role: 'user',
                content: userMessage
            }
        ];


        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Yapppo AI'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: messages,
                max_tokens: 500,
                temperature: 0.8,
                top_p: 0.9,
                frequency_penalty: 0.1,
                presence_penalty: 0.1
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from API');
        }

        const aiResponse = data.choices[0].message.content.trim();
        
        // Update chat history
        this.chatHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: aiResponse }
        );

        // Keep history manageable (last 10 exchanges)
        if (this.chatHistory.length > 20) {
            this.chatHistory = this.chatHistory.slice(-20);
        }

        return aiResponse;
    }

    addMessage(sender, content) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? 'You' : 'Y';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
        }
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    setProcessingState(processing) {
        this.isProcessing = processing;
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (chatInput && sendBtn) {
            chatInput.disabled = processing;
            sendBtn.disabled = processing || chatInput.value.trim().length === 0;
        }
    }

    toggleTTS() {
        this.ttsEnabled = !this.ttsEnabled;
        const ttsBtn = document.getElementById('tts-toggle');
        
        if (ttsBtn) {
            ttsBtn.classList.toggle('active', this.ttsEnabled);
            ttsBtn.title = this.ttsEnabled ? 'Disable Text-to-Speech' : 'Enable Text-to-Speech';
        }

        // Provide feedback
        if (this.ttsEnabled) {
            this.speak('Text to speech enabled');
        }
    }

    speak(text) {
        if (!this.ttsEnabled || !('speechSynthesis' in window)) {
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        // Try to use a natural voice
        const voices = speechSynthesis.getVoices();
        const preferredVoices = voices.filter(voice => 
            voice.lang.startsWith('en') && 
            (voice.name.includes('Natural') || voice.name.includes('Enhanced'))
        );
        
        if (preferredVoices.length > 0) {
            utterance.voice = preferredVoices[0];
        } else if (voices.length > 0) {
            const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
            if (englishVoices.length > 0) {
                utterance.voice = englishVoices[0];
            }
        }

        speechSynthesis.speak(utterance);
    }

    resetApp() {
        if (confirm('Are you sure you want to start over? This will clear your personality data and chat history.')) {
            // Clear stored data
            localStorage.removeItem('yapppo_personality');
            this.personalityData = null;
            this.chatHistory = [];
            
            // Reset UI
            const questionnaire = document.getElementById('questionnaire');
            const chat = document.getElementById('chat');
            const form = document.getElementById('personality-form');
            const messagesContainer = document.getElementById('chat-messages');
            
            if (questionnaire && chat) {
                questionnaire.style.display = 'block';
                chat.style.display = 'none';
            }
            
            if (form) {
                form.reset();
            }
            
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            
            // Reset button states
            const submitBtn = form?.querySelector('.primary-button');
            if (submitBtn) {
                submitBtn.disabled = false;
                const btnText = submitBtn.querySelector('.btn-text');
                const btnLoader = submitBtn.querySelector('.btn-loader');
                if (btnText) btnText.style.display = 'inline';
                if (btnLoader) btnLoader.style.display = 'none';
            }
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new YapppoAI();
});

// Handle speech synthesis voices loading
if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener('voiceschanged', () => {
        // Voices are now loaded and available
    });
}
