import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, User, Loader2 } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';

// Import avatar image (assuming it's in public/images)
const CHATBOT_AVATAR = '/images/avatar-chatbot.jpg';

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
}

export default function Chatbot() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('chatbot_session_id'));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      startConversation();
    }
  }, [isOpen]);

  const startConversation = () => {
    const greetingName = user?.firstName || user?.fullName;
    const greetingText = greetingName ? `Xin chào ${greetingName}!` : 'Xin chào!';
    
    const initialMessage: Message = {
      id: '1',
      type: 'bot',
      content: `${greetingText} Tôi là trợ lý tư vấn việc làm của Vieclamgannha.me 🎯\n\nTôi có thể giúp bạn tìm công việc phù hợp dựa trên thông tin của bạn. Hãy bắt đầu bằng cách cho tôi biết bạn muốn tìm việc ở đâu và loại công việc nào nhé!`,
    };
    setMessages([initialMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true); // Show overall loading
    setIsTyping(true); // Show typing indicator

    try {
      const apiMessages = messages.map(msg => ({
        role: msg.type === 'bot' ? 'assistant' : 'user',
        content: msg.content
      })).concat({ role: 'user', content: inputValue });

      const response = await fetch('/api/web-support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.data?.sessionId && data.data.sessionId !== sessionId) {
          setSessionId(data.data.sessionId);
          localStorage.setItem('chatbot_session_id', data.data.sessionId);
        }

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: data.data.reply
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        const errorData = await response.json();
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `Xin lỗi, có lỗi xảy ra: ${errorData.error || errorData.message || 'Không thể kết nối tới Chatbot'}`
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error sending message to chatbot:', error);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Xin lỗi, có lỗi kết nối đến Chatbot. Vui lòng thử lại sau.'
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group border-2 border-white"
        >
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/20">
            <img src={CHATBOT_AVATAR} alt="Chatbot Avatar" className="w-full h-full object-cover" />
          </div>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:pr-4 transition-all duration-300 whitespace-nowrap text-sm font-medium">
            Tư vấn việc làm
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 w-full h-[100dvh] md:bottom-6 md:right-6 md:w-96 md:h-[600px] bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-white/20">
                <img src={CHATBOT_AVATAR} alt="Chatbot Avatar" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-semibold">Trợ lý Vieclamgannha</h3>
                <p className="text-xs text-white/80">Tư vấn việc làm 24/7</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden ${
                    message.type === 'user' ? 'bg-blue-100 flex items-center justify-center' : ''
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-blue-600" />
                    ) : (
                      <img src={CHATBOT_AVATAR} alt="Bot Avatar" className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`space-y-2 ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-3 rounded-2xl text-sm whitespace-pre-line ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none shadow-sm'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <img src={CHATBOT_AVATAR} alt="Bot Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-2xl rounded-tl-none shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Nhập tin nhắn..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              Hoặc chọn nhanh ở trên
            </p>
          </div>
        </div>
      )}
    </>
  );
}
