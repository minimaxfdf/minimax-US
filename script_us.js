// ==UserScript==
// @name         DUC LOI - Clone Voice (Không cần API) - Modded
// @namespace    mmx-secure
// @version      35.0
// @description  Tạo audio giọng nói clone theo ý của bạn. Không giới hạn. Thêm chức năng Ghép hội thoại, Đổi văn bản hàng loạt & Thiết lập dấu câu (bao gồm dấu xuống dòng).
// @author       HUỲNH ĐỨC LỢI ( Zalo: 0835795597) - Đã chỉnh sửa
// @match        https://www.minimax.io/audio*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=minimax.io
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @connect      unpkg.com
// @connect      cdn.jsdelivr.net
// @connect      cloud.appwrite.io
// ==/UserScript==


/* ========================================================================== */
/* BẢN QUYỀN PHẦN MỀM THUỘC VỀ: HUỲNH ĐỨC LỢI         */
/* FB: @BĐỨC LỢI                                       */
/* ZALO: 0835795597                                      */
/* ========================================================================== */


(function () {
    'use strict';

    // =================================================================
    // == LỚP BẢO VỆ THỨ 6: NETWORK INTERCEPTION (CHẶN MẠNG) ==
    // == Chặn và kiểm tra payload trước khi gửi đến Minimax API ==
    // =================================================================
    (function() {
        'use strict';
        
        // FLAG: Bật/tắt chế độ thay text trong payload (thay vì set vào textarea)
        // Khi bật: Text thật chỉ đi qua network, không hiện trong UI
        if (typeof window.USE_PAYLOAD_MODE === 'undefined') {
            window.USE_PAYLOAD_MODE = true; // Mặc định bật
        }
        
        // Helper: Clear INTERCEPT_CURRENT_TEXT khi cần (đặt ở global scope để có thể truy cập từ bên ngoài)
        if (typeof window.clearInterceptText === 'undefined') {
            window.clearInterceptText = function(chunkIndex = null) {
                if (window.USE_PAYLOAD_MODE) {
                    // Nếu có chỉ định chunkIndex, chỉ clear khi đúng chunk
                    if (chunkIndex !== null && window.INTERCEPT_CURRENT_INDEX !== chunkIndex) {
                        return;
                    }
                    window.INTERCEPT_CURRENT_TEXT = null;
                    window.INTERCEPT_CURRENT_INDEX = null;
                    // Clear flag log để chunk tiếp theo có thể log lại
                    window._interceptLoggedForChunk = null;
                }
            };
        }
        
        // Helper: Log vào UI (nếu addLogEntry đã sẵn sàng)
        // BẢO MẬT: Không log các message liên quan đến NETWORK INTERCEPTOR
        function logToUI(message, type = 'info') {
            // BẢO MẬT: Bỏ qua tất cả log có chứa "[NETWORK INTERCEPTOR]"
            if (message && message.includes('[NETWORK INTERCEPTOR]')) {
                return; // Không log để bảo mật
            }
            
            try {
                // Thử tìm addLogEntry trong window hoặc closure
                if (typeof window.addLogEntry === 'function') {
                    window.addLogEntry(message, type);
                    return;
                }
                
                // Nếu không có, thử append trực tiếp vào log-container
                const logContainer = document.getElementById('log-container');
                if (logContainer) {
                    const logEntry = document.createElement('div');
                    logEntry.className = `log-entry ${type}`;
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    logEntry.textContent = `[${timeStr}] ${message}`;
                    logContainer.appendChild(logEntry);
                    logContainer.scrollTop = logContainer.scrollHeight;
                    return;
                }
                
                // Nếu không có log-container, không log vào console (bảo mật)
                // console.log(`[NETWORK INTERCEPTOR] ${message}`); // Đã ẩn để bảo mật
            } catch (e) {
                // Không log để bảo mật
                // console.log(`[NETWORK INTERCEPTOR] ${message}`); // Đã ẩn để bảo mật
            }
        }
        
        // Hàm kiểm tra và thay thế text mặc định trong payload bằng text đúng của chunk
        function cleanPayloadText(text, correctText = null) {
            if (!text || typeof text !== 'string') return text;
            
            // --- FIX BY GEMINI: ƯU TIÊN TUYỆT ĐỐI ---
            // Nếu có text chuẩn trong biến toàn cục, ÉP BUỘC thay thế ngay lập tức
            // Không cần quan tâm payload gốc có chứa "Hello..." hay không.
            if (window.INTERCEPT_CURRENT_TEXT) {
                const interceptText = window.INTERCEPT_CURRENT_TEXT;
                if (typeof interceptText === 'string' && interceptText.trim().length > 0) {
                    // Kiểm tra sơ bộ để tránh log spam (chỉ log nếu text khác nhau)
                    if (text !== interceptText) {
                        const currentIndex = window.INTERCEPT_CURRENT_INDEX;
                        // Chỉ log 1 lần cho mỗi chunk để đỡ lag
                        if (!window._interceptLoggedForChunk || window._interceptLoggedForChunk !== currentIndex) {
                            logToUI(`🛡️ [NETWORK INTERCEPTOR] Force-fix payload chunk ${(currentIndex || 0) + 1}`, 'warning');
                            window._interceptLoggedForChunk = currentIndex;
                        }
                    }
                    return interceptText; // Trả về ngay text đúng
                }
            }
            // -----------------------------------------
            
            // Lấy text đúng từ window nếu không được truyền vào
            if (!correctText && window.currentChunkText) {
                correctText = window.currentChunkText;
            }
            
            // Logic cũ (giữ lại làm fallback)
            let cleaned = text;
            let hasDefaultText = false;
            
            // Kiểm tra có chứa text mặc định không
            const hasEnglishGreeting = /Hello, I'm delighted[\s\S]*?journey together/gi.test(text);
            const hasVietnameseGreeting = /Xin chào, tôi rất vui[\s\S]*?sáng tạo âm thanh nhé\.?/gi.test(text);
            const hasChooseVoiceEN = /Choose a voice that resonates with you/gi.test(text);
            const hasChooseVoiceVN = /Hãy chọn một giọng nói phù hợp/gi.test(text);
            
            if (hasEnglishGreeting || hasVietnameseGreeting || hasChooseVoiceEN || hasChooseVoiceVN) {
                hasDefaultText = true;
                
                // Nếu có text đúng, thay thế toàn bộ bằng text đúng
                if (correctText && typeof correctText === 'string' && correctText.trim().length > 0) {
                    cleaned = correctText;
                    logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã thay thế text mặc định...`, 'warning');
                } else {
                    // Nếu không có text đúng, xóa text mặc định như cũ
                    cleaned = cleaned.replace(/Hello, I'm delighted[\s\S]*?journey together/gi, "");
                    cleaned = cleaned.replace(/Xin chào, tôi rất vui[\s\S]*?sáng tạo âm thanh nhé\.?/gi, "");
                    cleaned = cleaned.replace(/Choose a voice that resonates with you/gi, "");
                    cleaned = cleaned.replace(/Hãy chọn một giọng nói phù hợp/gi, "");
                    logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã xóa text mặc định...`, 'warning');
                }
            }
            
            return cleaned;
        }
        
        // Hàm xác minh payload có chứa text mặc định không (chỉ kiểm tra, không sửa)
        function verifyPayloadText(payload) {
            if (!payload) return { hasDefaultText: false, details: 'Payload rỗng' };
            
            let foundDefaultText = false;
            let foundInFields = [];
            let sampleText = '';
            
            // Nếu là string (JSON)
            if (typeof payload === 'string') {
                try {
                    const parsed = JSON.parse(payload);
                    if (parsed && typeof parsed === 'object') {
                        const textFields = ['text', 'content', 'message', 'prompt', 'input', 'data', 'value', 'query', 'text_input'];
                        
                        for (const field of textFields) {
                            if (parsed[field] && typeof parsed[field] === 'string') {
                                const text = parsed[field];
                                // Kiểm tra có chứa text mặc định không
                                if (text.includes('Hello, I\'m delighted') || 
                                    text.includes('Xin chào, tôi rất vui') ||
                                    text.includes('journey together') ||
                                    text.includes('sáng tạo âm thanh nhé') ||
                                    text.includes('Choose a voice') ||
                                    text.includes('Hãy chọn một giọng nói')) {
                                    foundDefaultText = true;
                                    foundInFields.push(field);
                                    sampleText = text.substring(0, 100) + '...';
                                }
                            }
                        }
                        
                        // Kiểm tra nested objects
                        function checkNested(obj, path = '') {
                            if (!obj || typeof obj !== 'object') return;
                            for (const key in obj) {
                                const currentPath = path ? `${path}.${key}` : key;
                                if (typeof obj[key] === 'string') {
                                    const text = obj[key];
                                    if (text.includes('Hello, I\'m delighted') || 
                                        text.includes('Xin chào, tôi rất vui') ||
                                        text.includes('journey together') ||
                                        text.includes('sáng tạo âm thanh nhé') ||
                                        text.includes('Choose a voice') ||
                                        text.includes('Hãy chọn một giọng nói')) {
                                        foundDefaultText = true;
                                        foundInFields.push(currentPath);
                                        if (!sampleText) sampleText = text.substring(0, 100) + '...';
                                    }
                                } else if (typeof obj[key] === 'object') {
                                    checkNested(obj[key], currentPath);
                                }
                            }
                        }
                        checkNested(parsed);
                    } else if (typeof parsed === 'string') {
                        const text = parsed;
                        if (text.includes('Hello, I\'m delighted') || 
                            text.includes('Xin chào, tôi rất vui') ||
                            text.includes('journey together') ||
                            text.includes('sáng tạo âm thanh nhé') ||
                            text.includes('Choose a voice') ||
                            text.includes('Hãy chọn một giọng nói')) {
                            foundDefaultText = true;
                            foundInFields.push('root');
                            sampleText = text.substring(0, 100) + '...';
                        }
                    }
                } catch (e) {
                    // Không phải JSON, kiểm tra trực tiếp như string
                    const text = payload;
                    if (text.includes('Hello, I\'m delighted') || 
                        text.includes('Xin chào, tôi rất vui') ||
                        text.includes('journey together') ||
                        text.includes('sáng tạo âm thanh nhé') ||
                        text.includes('Choose a voice') ||
                        text.includes('Hãy chọn một giọng nói')) {
                        foundDefaultText = true;
                        foundInFields.push('raw_string');
                        sampleText = text.substring(0, 100) + '...';
                    }
                }
            }
            
            // Nếu là FormData
            if (payload instanceof FormData) {
                for (const [key, value] of payload.entries()) {
                    if (typeof value === 'string') {
                        if (value.includes('Hello, I\'m delighted') || 
                            value.includes('Xin chào, tôi rất vui') ||
                            value.includes('journey together') ||
                            value.includes('sáng tạo âm thanh nhé') ||
                            value.includes('Choose a voice') ||
                            value.includes('Hãy chọn một giọng nói')) {
                            foundDefaultText = true;
                            foundInFields.push(`FormData.${key}`);
                            if (!sampleText) sampleText = value.substring(0, 100) + '...';
                        }
                    }
                }
            }
            
            return {
                hasDefaultText: foundDefaultText,
                foundInFields: foundInFields,
                sampleText: sampleText,
                details: foundDefaultText ? 
                    `⚠️ PHÁT HIỆN text mặc định trong các trường: ${foundInFields.join(', ')}` : 
                    '✅ Payload SẠCH, không có text mặc định'
            };
        }
        
        // Hàm xử lý payload (có thể là string JSON hoặc FormData)
        function processPayload(payload, url = '') {
            if (!payload) return payload;
            
            // --- FIX BY GEMINI: ƯU TIÊN TUYỆT ĐỐI ---
            // Nếu có INTERCEPT_CURRENT_TEXT, ÉP BUỘC thay thế ngay lập tức
            // Không cần điều kiện USE_PAYLOAD_MODE
            if (window.INTERCEPT_CURRENT_TEXT) {
                const interceptText = window.INTERCEPT_CURRENT_TEXT;
                const currentIndex = window.INTERCEPT_CURRENT_INDEX;
                
                if (typeof interceptText === 'string' && interceptText.trim().length > 0) {
                    // Nếu là string (JSON)
                    if (typeof payload === 'string') {
                        try {
                            // Debug: Log payload gốc để xem cấu trúc
                            if (!window._interceptLoggedForChunk || window._interceptLoggedForChunk !== currentIndex) {
                                console.log(`[DEBUG] Payload gốc (500 ký tự đầu):`, payload.substring(0, 500));
                            }
                            const parsed = JSON.parse(payload);
                            if (parsed && typeof parsed === 'object') {
                                // Tìm các trường có thể chứa text và thay trực tiếp (ưu tiên 'text')
                                const textFields = ['text', 'content', 'message', 'prompt', 'input', 'data', 'value', 'query', 'text_input'];
                                let modified = false;
                                let foundField = null;
                                
                                // Ưu tiên tìm field 'text' trước
                                if (parsed.text && typeof parsed.text === 'string') {
                                    parsed.text = interceptText;
                                    modified = true;
                                    foundField = 'text';
                                } else {
                                    // Nếu không có 'text', tìm các field khác
                                    for (const field of textFields) {
                                        if (parsed[field] && typeof parsed[field] === 'string') {
                                            parsed[field] = interceptText;
                                            modified = true;
                                            foundField = field;
                                            break; // Chỉ thay field đầu tiên tìm thấy
                                        }
                                    }
                                }
                                
                                // Nếu không tìm thấy ở root level, tìm trong nested objects (nhưng chỉ tìm field 'text')
                                if (!modified) {
                                    function findAndReplaceText(obj, path = '') {
                                        if (!obj || typeof obj !== 'object') return false;
                                        for (const key in obj) {
                                            const currentPath = path ? `${path}.${key}` : key;
                                            if (key === 'text' && typeof obj[key] === 'string') {
                                                obj[key] = interceptText;
                                                foundField = currentPath;
                                                return true;
                                            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                                if (findAndReplaceText(obj[key], currentPath)) {
                                                    return true;
                                                }
                                            }
                                        }
                                        return false;
                                    }
                                    modified = findAndReplaceText(parsed);
                                }
                                
                                if (modified) {
                                    // Chỉ log một lần cho mỗi chunk (dùng flag global)
                                    if (!window._interceptLoggedForChunk || window._interceptLoggedForChunk !== currentIndex) {
                                        logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã thay thế text trong payload (field: ${foundField}) bằng chunk ${(currentIndex || 0) + 1}`, 'warning');
                                        // Debug: Log payload sau khi thay thế (chỉ log một phần để không spam)
                                        const debugPayload = JSON.stringify(parsed).substring(0, 300);
                                        console.log(`[DEBUG] Payload sau khi thay thế (300 ký tự đầu): ${debugPayload}...`);
                                        window._interceptLoggedForChunk = currentIndex;
                                    }
                                    const result = JSON.stringify(parsed);
                                    console.log(`[DEBUG] Payload đã được stringify, độ dài: ${result.length} ký tự, field thay thế: ${foundField}`);
                                    return result;
                                } else {
                                    // Nếu không modified, log để debug
                                    console.warn(`[DEBUG] Không tìm thấy field text trong payload để thay thế. Payload gốc:`, payload.substring(0, 500));
                                    // Trả về payload gốc để không làm hỏng request
                                    return payload;
                                }
                            } else if (typeof parsed === 'string') {
                                // Chỉ log một lần cho mỗi chunk
                                if (!window._interceptLoggedForChunk || window._interceptLoggedForChunk !== currentIndex) {
                                    logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã thay thế text trong payload bằng chunk ${(currentIndex || 0) + 1}`, 'warning');
                                    window._interceptLoggedForChunk = currentIndex;
                                }
                                return interceptText;
                            }
                        } catch (e) {
                            // Không phải JSON hợp lệ, thay trực tiếp
                            // Chỉ log một lần cho mỗi chunk
                            if (!window._interceptLoggedForChunk || window._interceptLoggedForChunk !== currentIndex) {
                                logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã thay thế text trong payload bằng chunk ${(currentIndex || 0) + 1}`, 'warning');
                                window._interceptLoggedForChunk = currentIndex;
                            }
                            return interceptText;
                        }
                    }
                    
                    // Nếu là FormData
                    if (payload instanceof FormData) {
                        const newFormData = new FormData();
                        let formModified = false;
                        for (const [key, value] of payload.entries()) {
                            if (typeof value === 'string') {
                                newFormData.append(key, interceptText);
                                formModified = true;
                            } else {
                                newFormData.append(key, value);
                            }
                        }
                        if (formModified) {
                            // Chỉ log một lần cho mỗi chunk
                            if (!window._interceptLoggedForChunk || window._interceptLoggedForChunk !== currentIndex) {
                                logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã thay thế text trong payload bằng chunk ${(currentIndex || 0) + 1}`, 'warning');
                                window._interceptLoggedForChunk = currentIndex;
                            }
                        }
                        return newFormData;
                    }
                }
            }
            
            // XÁC MINH: Kiểm tra payload trước khi xử lý (chỉ khi không dùng PAYLOAD_MODE)
            const verification = verifyPayloadText(payload);
            if (verification.hasDefaultText) {
                logToUI(`⚠️ [NETWORK INTERCEPTOR] Phát hiện text mặc định...`, 'warning');
                
                // ĐÁNH DẤU CHUNK THẤT BẠI: Nếu phát hiện text mặc định trong payload, đánh dấu chunk hiện tại là failed
                const currentChunkIndex = window.currentChunkIndex;
                if (typeof currentChunkIndex === 'number' && currentChunkIndex >= 0) {
                    if (!window.chunkStatus) window.chunkStatus = [];
                    window.chunkStatus[currentChunkIndex] = 'failed';
                    
                    if (!window.failedChunks) window.failedChunks = [];
                    if (!window.failedChunks.includes(currentChunkIndex)) {
                        window.failedChunks.push(currentChunkIndex);
                        logToUI(`❌ [NETWORK INTERCEPTOR] Đã đánh dấu Chunk ${currentChunkIndex + 1} THẤT BẠI do phát hiện text mặc định trong payload. Sẽ retry sau.`, 'error');
                    }
                    
                    // Clear timeout nếu có
                    if (window.chunkTimeoutIds && window.chunkTimeoutIds[currentChunkIndex]) {
                        clearTimeout(window.chunkTimeoutIds[currentChunkIndex]);
                        delete window.chunkTimeoutIds[currentChunkIndex];
                    }
                    
                    // Reset sendingChunk flag
                    if (window.sendingChunk === currentChunkIndex) {
                        window.sendingChunk = null;
                    }
                }
            } else {
                // Chỉ log khi là request quan trọng (audio generation)
                if (url.includes('audio') || url.includes('voice') || url.includes('clone')) {
                    logToUI(`✅ [NETWORK INTERCEPTOR]`, 'info');
                }
            }
            
            // Nếu là string (JSON)
            if (typeof payload === 'string') {
                try {
                    const parsed = JSON.parse(payload);
                    if (parsed && typeof parsed === 'object') {
                        // Tìm các trường có thể chứa text (text, content, message, prompt, input, etc.)
                        const textFields = ['text', 'content', 'message', 'prompt', 'input', 'data', 'value', 'query', 'text_input'];
                        let modified = false;
                        
                        for (const field of textFields) {
                            if (parsed[field] && typeof parsed[field] === 'string') {
                                const cleaned = cleanPayloadText(parsed[field]);
                                if (cleaned !== parsed[field]) {
                                    parsed[field] = cleaned;
                                    modified = true;
                                }
                            }
                        }
                        
                        // Kiểm tra nested objects
                        function cleanNested(obj) {
                            if (!obj || typeof obj !== 'object') return;
                            for (const key in obj) {
                                if (typeof obj[key] === 'string') {
                                    const cleaned = cleanPayloadText(obj[key]);
                                    if (cleaned !== obj[key]) {
                                        obj[key] = cleaned;
                                        modified = true;
                                    }
                                } else if (typeof obj[key] === 'object') {
                                    cleanNested(obj[key]);
                                }
                            }
                        }
                        cleanNested(parsed);
                        
                        if (modified) {
                            logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã làm sạch payload...`, 'warning');
                            return JSON.stringify(parsed);
                        }
                    } else if (typeof parsed === 'string') {
                        // Nếu parse ra là string (không phải object), clean trực tiếp
                        return cleanPayloadText(parsed);
                    }
                } catch (e) {
                    // Không phải JSON, clean trực tiếp như string
                    return cleanPayloadText(payload);
                }
            }
            
            // Nếu là FormData
            if (payload instanceof FormData) {
                const newFormData = new FormData();
                let formModified = false;
                for (const [key, value] of payload.entries()) {
                    if (typeof value === 'string') {
                        const cleaned = cleanPayloadText(value);
                        if (cleaned !== value) {
                            formModified = true;
                        }
                        newFormData.append(key, cleaned);
                    } else {
                        newFormData.append(key, value);
                    }
                }
                if (formModified) {
                    logToUI(`🛡️ [NETWORK INTERCEPTOR] Đã làm sạch payload...`, 'warning');
                }
                return newFormData;
            }
            
            return payload;
        }
        
        // Intercept fetch API
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const [url, options = {}] = args;
            const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : '');
            
            // Chỉ intercept các request đến Minimax API
            if (urlStr && (urlStr.includes('minimax') || urlStr.includes('api') || urlStr.includes('audio') || urlStr.includes('voice'))) {
                try {
                    // Clone options để không modify original (clone sâu hơn để đảm bảo body được copy đúng)
                    const newOptions = { ...options };
                    if (options.headers) {
                        newOptions.headers = new Headers(options.headers);
                    }
                
                // Xử lý body nếu có
                    let payloadModified = false;
                if (newOptions.body) {
                    const originalBody = newOptions.body;
                    newOptions.body = processPayload(newOptions.body, urlStr);
                        payloadModified = (originalBody !== newOptions.body);
                        
                        // Log cho request quan trọng (audio generation)
                        if (urlStr.includes('audio') || urlStr.includes('voice') || urlStr.includes('clone')) {
                            if (payloadModified) {
                        // Xác minh lại payload sau khi sửa
                        const recheck = verifyPayloadText(newOptions.body);
                        if (recheck.hasDefaultText) {
                                    logToUI(`⚠️ [NETWORK INTERCEPTOR] Vẫn còn text mặc định sau khi thay thế`, 'error');
                        }
                                logToUI(`📤 [NETWORK INTERCEPTOR] Đang gửi request với payload đã được thay thế`, 'info');
                    } else {
                                logToUI(`📤 [NETWORK INTERCEPTOR] Đang gửi request (payload không thay đổi)`, 'info');
                            }
                        }
                    } else if (urlStr.includes('audio') || urlStr.includes('voice') || urlStr.includes('clone')) {
                        logToUI(`📤 [NETWORK INTERCEPTOR] Đang gửi request (không có body)`, 'info');
                    }
                    
                    // QUAN TRỌNG: Gửi request đi với payload đã được thay thế và intercept response
                    const fetchPromise = originalFetch.apply(this, [url, newOptions]);
                    
                    // Intercept response để debug
                    if (urlStr.includes('audio') || urlStr.includes('voice') || urlStr.includes('clone')) {
                        fetchPromise.then(response => {
                            console.log(`[DEBUG] Response status: ${response.status}`, response);
                            if (!response.ok) {
                                logToUI(`❌ [NETWORK INTERCEPTOR] Response lỗi: ${response.status} ${response.statusText}`, 'error');
                            } else {
                                logToUI(`✅ [NETWORK INTERCEPTOR] Response thành công: ${response.status}`, 'info');
                            }
                            return response;
                        }).catch(error => {
                            logToUI(`❌ [NETWORK INTERCEPTOR] Lỗi khi gửi request: ${error.message}`, 'error');
                            console.error('[NETWORK INTERCEPTOR] Fetch error:', error);
                        });
                    }
                    
                    return fetchPromise;
                } catch (error) {
                    // Nếu có lỗi khi xử lý payload, log và gửi request gốc
                    logToUI(`❌ [NETWORK INTERCEPTOR] Lỗi khi xử lý payload: ${error.message}. Gửi request gốc.`, 'error');
                    return originalFetch.apply(this, args);
                }
            }
            
            return originalFetch.apply(this, args);
        };
        
        // Intercept XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._interceptedUrl = url;
            return originalXHROpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = function(data) {
            // Chỉ intercept các request đến Minimax API
            if (this._interceptedUrl && (this._interceptedUrl.includes('minimax') || this._interceptedUrl.includes('api') || this._interceptedUrl.includes('audio') || this._interceptedUrl.includes('voice'))) {
                try {
                const originalData = data;
                const cleanedData = processPayload(data, this._interceptedUrl);
                    const payloadModified = (originalData !== cleanedData);
                    
                    // Log cho request quan trọng (audio generation)
                    if (this._interceptedUrl.includes('audio') || this._interceptedUrl.includes('voice') || this._interceptedUrl.includes('clone')) {
                        if (payloadModified) {
                    // Xác minh lại payload sau khi sửa
                    const recheck = verifyPayloadText(cleanedData);
                    if (recheck.hasDefaultText) {
                                logToUI(`⚠️ [NETWORK INTERCEPTOR] Vẫn còn text mặc định sau khi thay thế`, 'error');
                            }
                            logToUI(`📤 [NETWORK INTERCEPTOR] Đang gửi XMLHttpRequest với payload đã được thay thế`, 'info');
                    } else {
                            logToUI(`📤 [NETWORK INTERCEPTOR] Đang gửi XMLHttpRequest (payload không thay đổi)`, 'info');
                        }
                        
                        // Intercept response để debug
                        const originalOnReadyStateChange = this.onreadystatechange;
                        this.onreadystatechange = function() {
                            if (this.readyState === 4) {
                                console.log(`[DEBUG] XMLHttpRequest response status: ${this.status}`, this);
                                if (this.status >= 200 && this.status < 300) {
                                    logToUI(`✅ [NETWORK INTERCEPTOR] XMLHttpRequest thành công: ${this.status}`, 'info');
                } else {
                                    logToUI(`❌ [NETWORK INTERCEPTOR] XMLHttpRequest lỗi: ${this.status} ${this.statusText}`, 'error');
                                }
                            }
                            if (originalOnReadyStateChange) {
                                originalOnReadyStateChange.apply(this, arguments);
                            }
                        };
                    }
                    
                    // QUAN TRỌNG: Gửi request đi với payload đã được thay thế
                return originalXHRSend.apply(this, [cleanedData]);
                } catch (error) {
                    // Nếu có lỗi khi xử lý payload, log và gửi request gốc
                    logToUI(`❌ [NETWORK INTERCEPTOR] Lỗi khi xử lý XMLHttpRequest payload: ${error.message}. Gửi request gốc.`, 'error');
                    console.error('[NETWORK INTERCEPTOR] XMLHttpRequest error:', error);
                    return originalXHRSend.apply(this, [data]);
                }
            }
            
            return originalXHRSend.apply(this, [data]);
        };
        
        // Log khi interceptor được kích hoạt (đã ẩn để bảo mật)
        // console.log('[NETWORK INTERCEPTOR] Đã kích hoạt'); // Đã ẩn để bảo mật
        // logToUI('🛡️ [NETWORK INTERCEPTOR]', 'info'); // Đã ẩn để bảo mật
        // setTimeout(() => {
        //     logToUI('🛡️ [NETWORK INTERCEPTOR]', 'info'); // Đã ẩn để bảo mật
        // }, 2000);
    })();

    // =================================================================
    // == PHẦN CSS VÀ CÁC HÀM KHÁC ==
    // =================================================================

    const SCRIPT_CSS = `.logo{background:#fff;width:fit-content;padding:2px;border-radius:8px}.logo-user{display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:space-between;align-items:center}.mmx-login-prompt-btn{position:fixed;z-index:999990;background-color:#6a4ff1;color:#fff;padding:10px 20px;font-size:16px;font-weight:700;border:none;border-radius:8px;cursor:pointer;box-shadow:0 5px 15px rgba(0,0,0,0.3);text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;transition:transform .2s ease,background-color .2s ease;top:10px;left:50%}.mmx-login-prompt-btn:hover{background-color:#462fb8}#mmx-login-overlay{position:fixed;inset:0;z-index:999999;background:#0f1220;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center}#mmx-login-card{width:420px;max-width:92vw;background:#171a2a;border:1px solid #27304a;border-radius:14px;padding:22px 20px;box-shadow:0 10px 30px rgba(0,0,0,.45)}#mmx-login-card h2{font-size:20px;color:#8be9fd}#mmx-login-card p.sub{color:#94a3b8;font-size:13px}#mmx-login-form label{display:block;font-size:13px;margin-bottom:6px;color:#c7d2fe}#mmx-api-input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #334155;background:#0b1020;color:#e2e8f0;outline:none}#mmx-api-input::placeholder{color:#64748b}#mmx-login-actions{display:flex;gap:10px;margin-top:14px;align-items:center}#mmx-login-btn{flex:1;padding:10px 14px;background:#50fa7b;color:#0b1020;border:none;border-radius:10px;font-weight:700;cursor:pointer}#mmx-login-btn[disabled]{opacity:.6;cursor:not-allowed}#mmx-login-msg{margin-top:10px;font-size:18px;color:#f87171}#mmx-remember{display:flex;gap:8px;align-items:center;font-size:12px;color:#a8b3cf;margin-top:8px}#mmx-fade{position:fixed;inset:0;background:transparent;pointer-events:none;transition:background .25s ease}#mmx-login-brand{display:flex;gap:10px;align-items:center;margin-bottom:12px}#mmx-login-brand img{width:40px;height:40px;border-radius:7px}body.mmx-active{overflow:hidden}#gemini-main-container{display:flex;width:100vw;height:100vh;position:fixed;top:0;left:0;background-color:#282a36;color:#f8f8f2;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;gap:10px;padding:10px;box-sizing:border-box}.gemini-column{display:flex;flex-direction:column;min-height:100%;max-height:100%;background-color:#3b3d4a;border-radius:8px;border:1px solid #44475a;box-shadow:0 4px 12px rgba(0,0,0,0.2)}#gemini-col-1{width:20%}#gemini-col-2{width:60%}#gemini-col-3{width:20%}.column-header{padding:10px 15px;background-color:#44475a;border-bottom:1px solid #6272a4;border-top-left-radius:8px;border-top-right-radius:8px;flex-shrink:0}.column-header h3{margin:0;font-size:16px;color:#bd93f9}.column-content{padding:15px;overflow-y:auto;flex-grow:1}.box-info-version{display:flex;flex-direction:row;flex-wrap:nowrap;justify-content:space-between;align-items:center}.column-content::-webkit-scrollbar{width:6px}.column-content::-webkit-scrollbar-track{background:#282a36}.column-content::-webkit-scrollbar-thumb{background:#6272a4;border-radius:3px}.column-content::-webkit-scrollbar-thumb:hover{background:#bd93f9}.section{margin-bottom:20px}.section h4{margin:0 0 10px;color:#bd93f9;font-size:14px;border-bottom:1px solid #44475a;padding-bottom:5px}#gemini-file-input,#gemini-language-select,#gemini-main-textarea{width:100%;box-sizing:border-box;background-color:#282a36;color:#f8f8f2;border:1px solid #6272a4;border-radius:4px;padding:10px;margin-bottom:8px;font-size:14px}#gemini-main-textarea{height:42vh;resize:vertical}#gemini-text-stats{display:flex;justify-content:space-around;font-size:12px;color:#f1fa8c;background-color:#44475a;padding:5px;border-radius:4px;margin-top:5px}button{width:100%;padding:12px;border:none;border-radius:5px;font-weight:700;font-size:14px;cursor:pointer;transition:all .2s ease-in-out}button:disabled{background-color:#6c757d!important;color:#333!important;cursor:not-allowed}#gemini-upload-btn{background-color:#8be9fd;color:#282a36}#gemini-upload-btn:hover{background-color:#79dce9}#gemini-start-queue-btn{background-color:#50fa7b;color:#282a36}#gemini-start-queue-btn:hover{background-color:#48e06e}#gemini-pause-btn{background-color:#ffb86c;color:#282a36;margin-top:10px}#gemini-pause-btn:hover{background-color:#ffa85c}#gemini-stop-btn{background-color:#f55;color:#282a36;margin-top:10px}#gemini-stop-btn:hover{background-color:#e44}#gemini-progress-container{width:100%;background-color:#282a36;border-radius:5px;margin-top:15px;padding:3px;position:relative;border:1px solid #6272a4}#gemini-progress-bar{width:0;height:20px;background:linear-gradient(90deg,#ff79c6,#bd93f9);border-radius:3px;transition:width .4s ease-in-out}#gemini-progress-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-weight:700;font-size:12px;text-shadow:1px 1px 2px #000}#gemini-final-result{margin-top:20px}#gemini-time-taken{font-size:14px;color:#8be9fd;text-align:center;margin-bottom:10px;font-weight:700}#gemini-waveform{background-color:#282a36;border-radius:5px;border:1px solid #6272a4;padding:10px}#waveform-controls a,#waveform-controls button{display:inline-block;width:auto;padding:8px 15px;margin:0 5px;text-decoration:none;font-weight:700;border-radius:5px}#waveform-play-pause{background-color:#ffb86c;color:#282a36}#gemini-download-merged-btn{background-color:#8be9fd;color:#282a36}.banner-column a{display:block;margin-bottom:15px}.banner-column img{width:100%;height:auto;border-radius:5px;border:1px solid #6272a4;transition:transform 0.2s,box-shadow .2s}.banner-column img:hover{transform:scale(1.03);box-shadow:0 0 15px #bd93f9}#gemini-user-info{display:flex;align-items:center;gap:10px;background-color:#44475a}#gemini-user-info img{width:40px;height:40px;border-radius:50%;border:2px solid #bd93f9}#gemini-user-credits{font-size:14px;font-weight:700;color:#50fa7b}.social-minimax{margin:20px 0!important}.social-minimax a{display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:flex-start;gap:10px;margin-bottom:10px!important;cursor:pointer;font-size:14px;font-weight:700}.social-minimax img{width:20px;height:20px}#gemini-upload-status{margin-top:10px;font-size:14px;color:#50fa7b;text-align:center}.social-minimax-login{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto;gap:10px}.social-minimax.social-minimax-login{margin-bottom:0!important}.chinh-sach-su-dung,.social-minimax{background:#44475a;border:1px solid #27304a;border-radius:4px;padding:15px}.chinh-sach-su-dung h2,.social-minimax h2{font-size:16px;font-weight:700;margin-bottom:10px}.chinh-sach-su-dung ul{list-style:auto;padding-left:20px}.chinh-sach-su-dung ul{}.chinh-sach-su-dung li{margin-bottom:10px}.box-ads-img{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto;gap:10px}a.youtube123{display:flex;gap:10px;flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:flex-start;font-size: 16px;font-weight: bold;color: #ffe900;}.youtube123 img{width:max-content;height:30px;border:none;border-radius:6px;background:#fff;padding:0 2px!important}
/* Styles for Merge Button */
#gemini-merge-btn{background-color:#ffb86c;color:#282a36;margin-top:10px}
#gemini-merge-btn:hover{background-color:#ffa85c}
/* Styles for Batch Replace Section */
#batch-replace-section{margin-top:20px;background:#44475a;border:1px solid #27304a;border-radius:4px;padding:15px}
#batch-replace-section h4{margin:0 0 10px;color:#bd93f9;font-size:14px;border-bottom:1px solid #6272a4;padding-bottom:5px}
#batch-replace-pairs{display:flex;flex-direction:column;gap:8px;max-height:30vh;overflow-y:auto;padding-right:5px;margin-bottom:10px}
#batch-replace-pairs::-webkit-scrollbar{width:6px}
#batch-replace-pairs::-webkit-scrollbar-track{background:#282a36}
#batch-replace-pairs::-webkit-scrollbar-thumb{background:#6272a4;border-radius:3px}
#batch-replace-pairs::-webkit-scrollbar-thumb:hover{background:#bd93f9}
.replace-pair-row{display:flex;gap:8px;align-items:center}
.replace-pair-row input{flex-grow:1;width:40%;box-sizing:border-box;background-color:#282a36;color:#f8f8f2;border:1px solid #6272a4;border-radius:4px;padding:8px;font-size:12px}
.replace-pair-row .remove-pair-btn{width:28px;height:28px;padding:0;font-size:16px;line-height:28px;background-color:#f55;color:#f8f8f2;flex-shrink:0}
#batch-replace-actions{display:flex;gap:10px}
#add-replace-pair-btn{width:40px;background-color:#50fa7b;color:#282a36;padding:8px}
#execute-replace-btn{flex-grow:1;background-color:#8be9fd;color:#282a36;padding:8px}
/* Log Section Styles */
.log-section{background:#44475a;border:1px solid #27304a;border-radius:4px;padding:15px;margin-top:15px}
.log-section h2{font-size:16px;font-weight:700;margin-bottom:10px;color:#bd93f9}
.log-container{background:#282a36;border:1px solid #6272a4;border-radius:4px;padding:10px;max-height:25vh;overflow-y:auto;margin-bottom:10px}
.log-container::-webkit-scrollbar{width:6px}
.log-container::-webkit-scrollbar-track{background:#282a36}
.log-container::-webkit-scrollbar-thumb{background:#6272a4;border-radius:3px}
.log-container::-webkit-scrollbar-thumb:hover{background:#bd93f9}
.log-entry{color:#f8f8f2;font-size:12px;margin-bottom:5px;padding:3px 0;border-bottom:1px solid #44475a}
.log-entry:last-child{border-bottom:none}
.log-entry.info{color:#8be9fd}
.log-entry.success{color:#50fa7b}
.log-entry.warning{color:#ffb86c}
.log-entry.error{color:#f55}
.clear-log-btn{width:100%;background-color:#f55;color:#f8f8f2;padding:8px;border:none;border-radius:4px;font-weight:700;cursor:pointer;transition:background-color .2s ease}
.clear-log-btn:hover{background-color:#e44}

/* START: Styles for Punctuation Settings Modal */
#open-punctuation-settings-btn { margin-top: 20px; background-color: #6272a4; color: #f8f8f2; }
#open-punctuation-settings-btn:hover { background-color: #798bc0; }
.punctuation-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); z-index: 10000; display: flex; align-items: center; justify-content: center; }
.punctuation-modal-card { background: #3b3d4a; border-radius: 8px; border: 1px solid #44475a; box-shadow: 0 5px 20px rgba(0,0,0,0.3); width: 380px; max-width: 90vw; color: #f8f8f2; }
.punctuation-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background-color: #44475a; border-bottom: 1px solid #6272a4; border-top-left-radius: 8px; border-top-right-radius: 8px; }
.punctuation-modal-header h3 { margin: 0; font-size: 16px; color: #bd93f9; }
.punctuation-modal-close-btn { background: none; border: none; color: #f8f8f2; font-size: 24px; cursor: pointer; padding: 0; line-height: 1; width: auto; }
.punctuation-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
.punctuation-setting-row { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 10px; }
.punctuation-setting-row label { font-size: 14px; }
.punctuation-input-group { display: flex; align-items: center; background-color: #282a36; border: 1px solid #6272a4; border-radius: 4px; }
.punctuation-input-group button { width: 30px; height: 30px; background: #44475a; color: #f8f8f2; border: none; font-size: 18px; cursor: pointer; padding: 0; line-height: 30px; }
.punctuation-input-group button:first-child { border-top-left-radius: 3px; border-bottom-left-radius: 3px; border-right: 1px solid #6272a4; }
.punctuation-input-group button:last-child { border-top-right-radius: 3px; border-bottom-right-radius: 3px; border-left: 1px solid #6272a4; }
.punctuation-input-group input { width: 100%; text-align: center; background: transparent; border: none; color: #f8f8f2; padding: 5px; font-size: 14px; -moz-appearance: textfield; }
.punctuation-input-group input::-webkit-outer-spin-button, .punctuation-input-group input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.punctuation-modal-footer { padding: 12px 18px; background: #44475a; border-top: 1px solid #6272a4; display: flex; gap: 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
#save-punctuation-settings-btn { background-color: #50fa7b; color: #282a36; flex-grow: 1; }
#default-punctuation-settings-btn { background-color: #ffb86c; color: #282a36; flex-grow: 1; }
.punctuation-setting-row.toggle-row{grid-template-columns:1fr auto;padding-bottom:10px;border-bottom:1px solid #44475a;margin-bottom:15px}.toggle-row label{font-weight:700;color:#8be9fd}.switch{position:relative;display:inline-block;width:50px;height:28px}.switch input{opacity:0;width:0;height:0}.slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#6272a4;-webkit-transition:.4s;transition:.4s}.slider:before{position:absolute;content:"";height:20px;width:20px;left:4px;bottom:4px;background-color:#fff;-webkit-transition:.4s;transition:.4s}input:checked+.slider{background-color:#50fa7b}input:focus+.slider{box-shadow:0 0 1px #50fa7b}input:checked+.slider:before{-webkit-transform:translateX(22px);-ms-transform:translateX(22px);transform:translateX(22px)}.slider.round{border-radius:28px}.slider.round:before{border-radius:50%}
/* END: Styles for Punctuation Settings Modal */

/* START: Styles for Audio Manager Modal */
#open-audio-manager-btn {
    background: linear-gradient(135deg, #8be9fd 0%, #79dce9 100%) !important;
    box-shadow: 0 4px 12px rgba(139, 233, 253, 0.3) !important;
}

#open-audio-manager-btn:hover {
    background: linear-gradient(135deg, #79dce9 0%, #6bc5d8 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(139, 233, 253, 0.4) !important;
}

#open-history-btn {
    background: linear-gradient(135deg, #bd93f9 0%, #a78bfa 100%) !important;
    box-shadow: 0 4px 12px rgba(189, 147, 249, 0.3) !important;
}

#open-history-btn:hover {
    background: linear-gradient(135deg, #a78bfa 0%, #9575cd 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(189, 147, 249, 0.4) !important;
}

#open-batch-render-modal-btn {
    background: linear-gradient(135deg, #ffb86c 0%, #ffa94d 100%) !important;
    box-shadow: 0 4px 12px rgba(255, 184, 108, 0.3) !important;
}

#open-batch-render-modal-btn:hover {
    background: linear-gradient(135deg, #ffa94d 0%, #ff9a3c 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(255, 184, 108, 0.4) !important;
}

.history-item {
    background: #44475a;
    border: 1px solid #6272a4;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 10px;
    transition: all 0.3s ease;
}

.history-item:hover {
    background: #4a4d61;
    border-color: #bd93f9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(189, 147, 249, 0.2);
}

.history-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.history-item-name {
    font-weight: bold;
    color: #f8f8f2;
    font-size: 14px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 10px;
}

.history-item-actions {
    display: flex;
    gap: 8px;
}

.history-item-action-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    transition: all 0.2s ease;
}

.history-item-play-btn {
    background-color: #50fa7b;
    color: #282a36;
}

.history-item-play-btn:hover {
    background-color: #45e06a;
}

.history-item-download-btn {
    background-color: #8be9fd;
    color: #282a36;
    text-decoration: none;
    display: inline-block;
}

.history-item-download-btn:hover {
    background-color: #79dce9;
}

.history-item-delete-btn {
    background-color: #ff5555;
    color: #f8f8f2;
}

.history-item-delete-btn:hover {
    background-color: #ff4444;
}

.history-item-info {
    display: flex;
    gap: 15px;
    font-size: 12px;
    color: #94a3b8;
}

.history-item-info span {
    display: flex;
    align-items: center;
    gap: 5px;
}

#audio-manager-modal {
    z-index: 10001 !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    background: rgba(0, 0, 0, 0.6) !important;
    display: none !important; /* Mặc định ẩn */
    align-items: center !important;
    justify-content: center !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    /* Đảm bảo tính từ viewport, không phải từ container cha */
    transform: none !important;
    box-sizing: border-box !important;
}

/* Khi modal được hiển thị (có style="display:flex" hoặc display:flex) */
#audio-manager-modal[style*="display: flex"],
#audio-manager-modal[style*="display:flex"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-direction: row !important;
}

/* Đảm bảo modal card được căn giữa - Override tất cả CSS có thể làm lệch */
#audio-manager-modal .punctuation-modal-card,
#audio-manager-modal.punctuation-modal .punctuation-modal-card,
.punctuation-modal#audio-manager-modal .punctuation-modal-card {
    margin: 0 auto !important;
    margin-left: auto !important;
    margin-right: auto !important;
    margin-top: auto !important;
    margin-bottom: auto !important;
    position: relative !important;
    transform: none !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    float: none !important;
    clear: both !important;
    display: flex !important;
    flex-direction: column !important;
    align-self: center !important;
    justify-self: center !important;
}

/* Đảm bảo modal container căn giữa card */
#audio-manager-modal.punctuation-modal,
#audio-manager-modal[class*="punctuation-modal"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-direction: row !important;
    text-align: center !important;
}

/* Đảm bảo modal không bị giới hạn bởi container cha - Tính từ viewport */
#gemini-col-3 #audio-manager-modal,
#gemini-col-2 #audio-manager-modal,
#gemini-col-1 #audio-manager-modal,
#gemini-main-container #audio-manager-modal,
body #audio-manager-modal,
html #audio-manager-modal {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    z-index: 10001 !important;
    overflow: visible !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 !important;
    padding: 0 !important;
    /* Đảm bảo tính từ viewport, không phải từ container cha */
    transform: none !important;
    box-sizing: border-box !important;
    /* Loại bỏ mọi positioning từ container cha */
    inset: 0 !important;
}

/* Đảm bảo container cha không giới hạn modal */
#gemini-main-container,
#gemini-col-1,
#gemini-col-2,
#gemini-col-3 {
    overflow: visible !important;
}

/* Đảm bảo cột 3 luôn có thể tương tác được khi modal đóng */
#gemini-col-3 {
    position: relative !important;
    z-index: 1 !important;
    pointer-events: auto !important;
}

/* Đảm bảo modal chỉ che phủ khi đang hiển thị */
#audio-manager-modal[style*="display: none"],
#audio-manager-modal[style*="display:none"],
#audio-manager-modal:not([style*="display: flex"]):not([style*="display:flex"]) {
    display: none !important;
    pointer-events: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    z-index: -1 !important;
}

/* START: Styles for History Modal - Đảm bảo hiển thị đầy đủ trong cột 3 */
#history-modal {
    z-index: 10001 !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    background: rgba(0, 0, 0, 0.6) !important;
    display: none !important; /* Mặc định ẩn */
    align-items: center !important;
    justify-content: center !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    box-sizing: border-box !important;
}

/* Khi modal được hiển thị */
#history-modal[style*="display: flex"],
#history-modal[style*="display:flex"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-direction: row !important;
}

/* Đảm bảo modal card được căn giữa và có thể co giãn */
#history-modal .punctuation-modal-card,
#history-modal.punctuation-modal .punctuation-modal-card,
.punctuation-modal#history-modal .punctuation-modal-card {
    margin: 0 auto !important;
    position: relative !important;
    transform: none !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    float: none !important;
    clear: both !important;
    display: flex !important;
    flex-direction: column !important;
    align-self: center !important;
    justify-self: center !important;
    width: 80vw !important;
    max-width: 900px !important;
    max-height: 90vh !important;
    height: auto !important;
    min-height: 300px !important;
    overflow: visible !important;
    border-radius: 8px !important;
}

/* Đảm bảo modal container căn giữa card */
#history-modal.punctuation-modal,
#history-modal[class*="punctuation-modal"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-direction: row !important;
    text-align: center !important;
}

/* Đảm bảo modal không bị giới hạn bởi container cha - Tính từ viewport */
#gemini-col-3 #history-modal,
#gemini-col-2 #history-modal,
#gemini-col-1 #history-modal,
#gemini-main-container #history-modal,
body #history-modal,
html #history-modal {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    z-index: 10001 !important;
    overflow: visible !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    box-sizing: border-box !important;
    inset: 0 !important;
}

/* Đảm bảo modal body có thể scroll và hiển thị đầy đủ */
#history-modal .punctuation-modal-body {
    overflow-y: auto !important;
    overflow-x: visible !important;
    max-height: calc(90vh - 120px) !important;
    min-height: 200px !important;
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
}

/* Đảm bảo modal chỉ che phủ khi đang hiển thị */
#history-modal[style*="display: none"],
#history-modal[style*="display:none"],
#history-modal:not([style*="display: flex"]):not([style*="display:flex"]) {
    display: none !important;
    pointer-events: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    z-index: -1 !important;
}
/* END: Styles for History Modal */

/* START: Styles for Batch Render Modal - Đảm bảo hiển thị đầy đủ */
#batch-render-modal {
    z-index: 10001 !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    background: rgba(0, 0, 0, 0.6) !important;
    display: none !important; /* Mặc định ẩn */
    align-items: center !important;
    justify-content: center !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    box-sizing: border-box !important;
}

/* Khi modal được hiển thị */
#batch-render-modal[style*="display: flex"],
#batch-render-modal[style*="display:flex"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-direction: row !important;
}

/* Đảm bảo modal card được căn giữa và có thể co giãn */
#batch-render-modal .punctuation-modal-card,
#batch-render-modal.punctuation-modal .punctuation-modal-card,
.punctuation-modal#batch-render-modal .punctuation-modal-card {
    margin: 0 auto !important;
    position: relative !important;
    transform: none !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    float: none !important;
    clear: both !important;
    display: flex !important;
    flex-direction: column !important;
    align-self: center !important;
    justify-self: center !important;
    width: 80vw !important;
    max-width: 900px !important;
    max-height: 90vh !important;
    height: auto !important;
    min-height: 300px !important;
    overflow: visible !important;
    border-radius: 8px !important;
}

/* Đảm bảo modal container căn giữa card */
#batch-render-modal.punctuation-modal,
#batch-render-modal[class*="punctuation-modal"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-direction: row !important;
    text-align: center !important;
}

/* Đảm bảo modal không bị giới hạn bởi container cha - Tính từ viewport */
#gemini-col-2 #batch-render-modal,
#gemini-col-3 #batch-render-modal,
#gemini-col-1 #batch-render-modal,
#gemini-main-container #batch-render-modal,
body #batch-render-modal,
html #batch-render-modal {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    z-index: 10001 !important;
    overflow: visible !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    box-sizing: border-box !important;
    inset: 0 !important;
}

/* Đảm bảo modal body có thể scroll và hiển thị đầy đủ */
#batch-render-modal .punctuation-modal-body {
    overflow-y: auto !important;
    overflow-x: visible !important;
    max-height: calc(90vh - 120px) !important;
    min-height: 200px !important;
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
}

/* Đảm bảo modal chỉ che phủ khi đang hiển thị */
#batch-render-modal[style*="display: none"],
#batch-render-modal[style*="display:none"],
#batch-render-modal:not([style*="display: flex"]):not([style*="display:flex"]) {
    display: none !important;
    pointer-events: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    z-index: -1 !important;
}
/* END: Styles for Batch Render Modal */

/* Đảm bảo các modal khác cũng không che phủ cột 3 khi đóng */
.punctuation-modal[style*="display: none"],
.punctuation-modal:not([style*="display: flex"]) {
    pointer-events: none !important;
    z-index: -1 !important;
}

#punctuation-detection-modal[style*="display: none"],
#punctuation-detection-modal:not([style*="display: flex"]) {
    pointer-events: none !important;
    z-index: -1 !important;
}

/* Đảm bảo body và html không giới hạn modal */
html, body {
    overflow: visible !important;
}

#audio-manager-modal .punctuation-modal-card {
    display: flex;
    flex-direction: column;
    position: relative !important;
    max-width: 1400px !important;
    max-height: 90vh !important;
    width: 80vw !important;
    height: 90vh !important;
}

#audio-manager-iframe {
    background: #282a36 !important;
}

#folder-select-btn {
    background-color: #8be9fd;
    color: #282a36;
    margin-bottom: 10px;
}

#folder-select-btn:hover {
    background-color: #79dce9;
}

#selected-folder-path {
    background: #282a36;
    border: 1px solid #6272a4;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 10px;
    color: #f1fa8c;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
}

#selected-folder-path:hover {
    background-color: #44475a;
    border-radius: 4px;
    padding: 4px 8px;
}

#audio-list-container {
    max-height: 30vh;
    overflow-y: auto;
    background: #282a36;
    border: 1px solid #6272a4;
    border-radius: 4px;
    margin-bottom: 10px;
}

#audio-list-container::-webkit-scrollbar {
    width: 6px;
}

#audio-list-container::-webkit-scrollbar-track {
    background: #282a36;
}

#audio-list-container::-webkit-scrollbar-thumb {
    background: #6272a4;
    border-radius: 3px;
}

#audio-list-container::-webkit-scrollbar-thumb:hover {
    background: #bd93f9;
}

.audio-item {
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid #44475a;
    transition: background-color 0.2s ease;
}

.audio-item:hover {
    background-color: #44475a;
}

.audio-item.playing {
    background-color: #50fa7b;
    color: #282a36;
}

.audio-name {
    flex-grow: 1;
    font-size: 12px;
    color: #f8f8f2;
    margin-right: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.audio-duration {
    font-size: 11px;
    color: #8be9fd;
    margin-right: 10px;
    min-width: 40px;
}

.play-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 12px;
    background-color: #6272a4;
    color: #f8f8f2;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease;
}

.play-btn:hover {
    background-color: #50fa7b;
    color: #282a36;
}

.play-btn:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
}

#refresh-audio-list-btn {
    background-color: #50fa7b;
    color: #282a36;
    font-size: 12px;
    padding: 8px;
}

#refresh-audio-list-btn:hover {
    background-color: #48e06e;
}
/* END: Styles for Audio Folder Manager */

/* START: Styles for Punctuation Detection Modal */
#punctuation-detection-modal {
    backdrop-filter: blur(5px);
    animation: fadeIn 0.3s ease;
}

#punctuation-detection-modal > div {
    animation: slideIn 0.3s ease;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

/* Danh sách lỗi dấu câu */
#punctuation-issues-list {
    max-height: 35vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #6272a4 #282a36;
}

#punctuation-issues-list::-webkit-scrollbar {
    width: 8px;
}

#punctuation-issues-list::-webkit-scrollbar-track {
    background: #282a36;
    border-radius: 4px;
}

#punctuation-issues-list::-webkit-scrollbar-thumb {
    background: #6272a4;
    border-radius: 4px;
}

#punctuation-issues-list::-webkit-scrollbar-thumb:hover {
    background: #50fa7b;
}

/* Nút trong modal */
#auto-fix-punctuation-btn, #ignore-punctuation-btn {
    transition: all 0.3s ease;
    font-weight: bold;
    position: relative;
    overflow: hidden;
}

#auto-fix-punctuation-btn:hover {
    background: #45e06a !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(80, 250, 123, 0.4);
}

#ignore-punctuation-btn:hover {
    background: #5a6a8a !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(98, 114, 164, 0.4);
}

/* Nút đóng modal */
#close-punctuation-modal {
    transition: all 0.2s ease;
}

#close-punctuation-modal:hover {
    background: #ff3333 !important;
    transform: scale(1.1);
}

/* Select dropdown */
#default-punctuation-select {
    transition: all 0.2s ease;
}

#default-punctuation-select:hover {
    border-color: #50fa7b !important;
    box-shadow: 0 0 0 2px rgba(80, 250, 123, 0.2);
}

#default-punctuation-select:focus {
    outline: none;
    border-color: #50fa7b !important;
    box-shadow: 0 0 0 2px rgba(80, 250, 123, 0.3);
}

/* Items trong danh sách lỗi */
.punctuation-issue-item {
    transition: all 0.2s ease;
}

.punctuation-issue-item:hover {
    transform: translateX(5px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Animations */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-30px) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* Responsive design */
@media (max-width: 768px) {
    #punctuation-detection-modal > div {
        width: 95%;
        padding: 15px;
        max-height: 90vh;
    }

    #punctuation-detection-modal h3 {
        font-size: 16px;
    }

    #auto-fix-punctuation-btn, #ignore-punctuation-btn {
        min-width: 100px;
        padding: 10px 16px;
        font-size: 13px;
    }

    .punctuation-issue-item {
        padding: 10px;
        font-size: 13px;
    }
}

@media (max-width: 480px) {
    #punctuation-detection-modal > div {
        width: 98%;
        padding: 10px;
    }

    #punctuation-detection-modal h3 {
        font-size: 14px;
    }

    #auto-fix-punctuation-btn, #ignore-punctuation-btn {
        width: 100%;
        margin: 5px 0;
    }
}
/* END: Styles for Punctuation Detection Modal */

/* START: Styles for Custom Filename Input */
#custom-filename-input {
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%) !important;
    border: 2px solid #6272a4 !important;
    border-radius: 12px !important;
    padding: 14px !important;
    transition: all 0.3s ease !important;
    font-family: inherit !important;
    color: #f8f8f2 !important;
    font-size: 14px !important;
}

#custom-filename-input:focus {
    border-color: #8be9fd !important;
    box-shadow: 0 0 0 3px rgba(139, 233, 253, 0.1) !important;
    outline: none !important;
}

#custom-filename-input::placeholder {
    color: #94a3b8 !important;
    font-style: italic !important;
}

.custom-filename-section {
    background: rgba(68, 75, 90, 0.3) !important;
    border: 1px solid rgba(98, 114, 164, 0.2) !important;
    border-radius: 8px !important;
    padding: 15px !important;
    margin-top: 15px !important;
}

.custom-filename-section label {
    color: #bd93f9 !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    margin-bottom: 8px !important;
    display: block !important;
}

.custom-filename-section small {
    color: #94a3b8 !important;
    font-size: 12px !important;
    margin-top: 5px !important;
    display: block !important;
    line-height: 1.4 !important;
}
/* END: Styles for Custom Filename Input */

/* ===== MODERN UI IMPROVEMENTS ===== */
* {
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
}

/* Enhanced Logo */
.logo {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    width: fit-content !important;
    padding: 8px 12px !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3) !important;
    color: white !important;
    font-weight: 700 !important;
    font-size: 18px !important;
}

/* Enhanced Main Container */
#gemini-main-container {
    background: linear-gradient(135deg, #1a1d2e 0%, #16213e 100%) !important;
    gap: 16px !important;
    padding: 16px !important;
}

/* Enhanced Columns */
.gemini-column {
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%) !important;
    border-radius: 16px !important;
    border: 1px solid #4a5568 !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    backdrop-filter: blur(20px) !important;
    overflow: hidden !important;
}

#gemini-col-1 {
    width: 24% !important;
    min-width: 200px !important;
    flex: 0 0 24% !important;
    max-width: 24% !important;
}

#gemini-col-2 {
    width: calc(52% - 32px) !important;
    min-width: 400px !important;
    flex: 0 0 calc(52% - 32px) !important;
    max-width: calc(52% - 32px) !important;
}

/* Two-column layout for gemini-col-2 */
#gemini-col-2 .column-content {
    display: flex !important;
    flex-direction: row !important;
    gap: 16px !important;
    padding: 20px !important;
}

#gemini-col-2-left {
    flex: 1 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    min-width: 0 !important;
}

#gemini-col-2-right {
    flex: 0 0 35% !important;
    max-width: 400px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    min-width: 0 !important;
}

/* Style buttons in right column */
#gemini-col-2-right button {
    width: 100% !important;
    margin-bottom: 10px !important;
}

#gemini-col-2-right #gemini-progress-container {
    width: 100% !important;
}

#gemini-col-2-right #gemini-final-result {
    width: 100% !important;
}

/* Waveform controls - horizontal layout */
#waveform-controls {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 10px !important;
    flex-wrap: wrap !important;
    margin-top: 10px !important;
}

#waveform-controls button,
#waveform-controls a {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    white-space: nowrap !important;
    text-align: center !important;
    padding: 10px 15px !important;
    box-sizing: border-box !important;
}

/* Make main container and columns adapt both width and height */
#gemini-main-container {
    display: flex !important;
    flex-wrap: nowrap !important;
    align-items: stretch !important;
    min-height: 100vh !important;
}
.gemini-column {
    display: flex !important;
    flex-direction: column !important;
    min-height: 0 !important;
}

#gemini-col-1 .column-content,
#gemini-col-2 .column-content {
    flex: 1 1 auto !important;
    overflow: auto !important;
    min-height: 0 !important;
}

/* Adaptive heights for key components */
#gemini-main-textarea {
    width: 100% !important;
    min-height: 160px !important;
    height: clamp(180px, 40vh, 560px) !important;
    resize: vertical !important;
}

/* Responsive: adjust columns for medium screens */
@media (max-width: 1200px) {
    #gemini-col-1 {
        width: 36% !important;
        min-width: 200px !important;
        flex: 0 0 36% !important;
        max-width: 36% !important;
    }
    #gemini-col-2 {
        width: calc(28% - 32px) !important;
        min-width: 380px !important;
        flex: 0 0 calc(28% - 32px) !important;
        max-width: calc(28% - 32px) !important;
    }
    #gemini-col-3 {
        width: 36% !important;
        min-width: 200px !important;
        flex: 0 0 36% !important;
        max-width: 36% !important;
    }
}

/* Responsive: stack main columns on small screens */
@media (max-width: 900px) {
    #gemini-col-1,
    #gemini-col-2 {
        width: 100% !important;
        min-width: 0 !important;
    }
}

/* Responsive: stack inner two-column layout for content area */
@media (max-width: 992px) {
    #gemini-col-2 .column-content {
        flex-direction: column !important;
        padding: 16px !important;
    }
    #gemini-col-2-right {
        flex: 1 1 auto !important;
        max-width: 100% !important;
    }
}

/* Responsive: tighter paddings for very small screens */
@media (max-width: 600px) {
    #gemini-main-container {
        padding: 10px !important;
        gap: 10px !important;
    }
    .column-header {
        padding: 12px 14px !important;
    }
    #gemini-col-2 .column-content {
        padding: 12px !important;
        gap: 12px !important;
    }
}

#waveform-play-pause {
    flex: 0 0 auto !important;
    min-width: 50px !important;
    max-width: 80px !important;
}

#gemini-download-merged-btn,
#gemini-download-chunks-btn {
    flex: 1 1 0 !important;
    min-width: 120px !important;
}

#gemini-col-3 {
    width: 24% !important;
    min-width: 200px !important;
    flex: 0 0 24% !important;
    max-width: 24% !important;
}

/* Enhanced Headers */
.column-header {
    padding: 16px 20px !important;
    background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%) !important;
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
    position: relative !important;
}

.column-header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #8be9fd, #bd93f9, #ff79c6);
}

.column-header h3 {
    font-size: 18px !important;
    font-weight: 700 !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

/* Enhanced Content */
.column-content {
    padding: 20px !important;
    background: rgba(45, 55, 72, 0.3) !important;
}

.column-content::-webkit-scrollbar {
    width: 8px !important;
}

.column-content::-webkit-scrollbar-track {
    background: #2d3748 !important;
    border-radius: 4px !important;
}

.column-content::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #6272a4, #bd93f9) !important;
    border-radius: 4px !important;
    transition: all 0.3s ease !important;
}

.column-content::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #bd93f9, #ff79c6) !important;
}

/* Enhanced Sections */
.section {
    margin-bottom: 24px !important;
    background: rgba(68, 75, 90, 0.3) !important;
    border-radius: 12px !important;
    padding: 16px !important;
    border: 1px solid rgba(98, 114, 164, 0.2) !important;
    backdrop-filter: blur(10px) !important;
}

.section h4 {
    font-size: 16px !important;
    border-bottom: 2px solid #44475a !important;
    padding-bottom: 8px !important;
    font-weight: 700 !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

/* Enhanced Inputs */
#gemini-file-input,
#gemini-language-select,
#gemini-main-textarea {
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%) !important;
    border: 2px solid #4a5568 !important;
    border-radius: 12px !important;
    padding: 14px !important;
    margin-bottom: 12px !important;
    transition: all 0.3s ease !important;
    font-family: inherit !important;
}

#gemini-file-input:focus,
#gemini-language-select:focus,
#gemini-main-textarea:focus {
    border-color: #8be9fd !important;
    box-shadow: 0 0 0 3px rgba(139, 233, 253, 0.1) !important;
    outline: none !important;
}

#gemini-main-textarea {
    line-height: 1.6 !important;
}

/* Enhanced Stats */
#gemini-text-stats {
    background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%) !important;
    padding: 12px !important;
    border-radius: 12px !important;
    margin-top: 8px !important;
    border: 1px solid rgba(98, 114, 164, 0.3) !important;
    font-weight: 600 !important;
}

/* Enhanced Buttons */
button {
    padding: 14px !important;
    border-radius: 12px !important;
    font-size: 15px !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    position: relative !important;
    overflow: hidden !important;
    font-family: inherit !important;
}

button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
}

button:hover::before {
    left: 100%;
}

button:disabled {
    background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%) !important;
    transform: none !important;
}

/* Enhanced Specific Buttons */
#gemini-upload-btn {
    background: linear-gradient(135deg, #8be9fd 0%, #79dce9 100%) !important;
    box-shadow: 0 4px 15px rgba(139, 233, 253, 0.3) !important;
}

#gemini-upload-btn:hover {
    background: linear-gradient(135deg, #79dce9 0%, #6bc5d8 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(139, 233, 253, 0.4) !important;
}

#gemini-start-queue-btn {
    background: linear-gradient(135deg, #50fa7b 0%, #4ade80 100%) !important;
    box-shadow: 0 4px 15px rgba(80, 250, 123, 0.3) !important;
}

#gemini-start-queue-btn:hover {
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(80, 250, 123, 0.4) !important;
}

#gemini-pause-btn {
    background: linear-gradient(135deg, #ffb86c 0%, #ffa85c 100%) !important;
    margin-top: 12px !important;
    box-shadow: 0 4px 15px rgba(255, 184, 108, 0.3) !important;
}

#gemini-pause-btn:hover {
    background: linear-gradient(135deg, #ffa85c 0%, #ff9500 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(255, 184, 108, 0.4) !important;
}

#gemini-stop-btn {
    background: linear-gradient(135deg, #ff5555 0%, #e44 100%) !important;
    margin-top: 12px !important;
    box-shadow: 0 4px 15px rgba(255, 85, 85, 0.3) !important;
}

#gemini-stop-btn:hover {
    background: linear-gradient(135deg, #e44 0%, #d33 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(255, 85, 85, 0.4) !important;
}

#gemini-merge-btn {
    background: linear-gradient(135deg, #ffb86c 0%, #ffa85c 100%) !important;
    margin-top: 12px !important;
    box-shadow: 0 4px 15px rgba(255, 184, 108, 0.3) !important;
}

#gemini-merge-btn:hover {
    background: linear-gradient(135deg, #ffa85c 0%, #ff9500 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(255, 184, 108, 0.4) !important;
}

/* Text Input Options Styles */
.text-input-options {
    margin-bottom: 16px;
}

.input-tabs {
    display: flex;
    margin-bottom: 12px;
    background: rgba(68, 75, 90, 0.3);
    border-radius: 8px;
    padding: 4px;
    border: 1px solid rgba(98, 114, 164, 0.2);
}

.tab-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-weight: 600;
    font-size: 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin: 0;
    width: auto;
}

.tab-btn.active {
    background: linear-gradient(135deg, #8be9fd 0%, #79dce9 100%);
    color: #282a36;
    box-shadow: 0 2px 8px rgba(139, 233, 253, 0.3);
}

.tab-btn:hover:not(.active) {
    background: rgba(189, 147, 249, 0.1);
    color: #bd93f9;
}

.input-area {
    display: none;
}

.input-area.active {
    display: block;
}

/* File Upload Styles */
.file-upload-section {
    margin-bottom: 12px;
}

.file-upload-area {
    border: 2px dashed #6272a4;
    border-radius: 12px;
    padding: 40px 20px;
    text-align: center;
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.file-upload-area:hover {
    border-color: #8be9fd;
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(139, 233, 253, 0.2);
}

.file-upload-area.dragover {
    border-color: #50fa7b;
    background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
    box-shadow: 0 0 20px rgba(80, 250, 123, 0.3);
}

.upload-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.7;
}

.upload-text {
    color: #f8f8f2;
}

.upload-text strong {
    color: #bd93f9;
    font-size: 16px;
    display: block;
    margin-bottom: 8px;
}

.upload-text small {
    color: #94a3b8;
    font-size: 12px;
}

.file-info {
    background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
    border: 1px solid rgba(98, 114, 164, 0.3);
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
}

.file-details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.file-name {
    color: #8be9fd;
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-size {
    color: #94a3b8;
    font-size: 12px;
    flex-shrink: 0;
}

.remove-file-btn {
    background: linear-gradient(135deg, #ff5555 0%, #e44 100%);
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    width: auto;
}

.remove-file-btn:hover {
    background: linear-gradient(135deg, #e44 0%, #d33 100%);
    transform: scale(1.1);
    box-shadow: 0 4px 15px rgba(255, 85, 85, 0.4);
}

/* Sales Announcement Styles */
.sales-announcement {
    margin-top: 15px;
    background: linear-gradient(135deg, #44475a 0%, #3b3d4a 100%);
    border: 2px solid #bd93f9;
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 4px 15px rgba(189, 147, 249, 0.3);
    max-width: 100%;
}

.sales-announcement h3 {
    color: #ff79c6;
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 10px 0;
    text-align: center;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.sales-announcement .sales-content {
    color: #f8f8f2;
    font-size: 12px;
    line-height: 1.5;
    display: flex;
    gap: 12px;
}

.sales-announcement .sales-content .sales-left,
.sales-announcement .sales-content .sales-right {
    flex: 1;
}

.sales-announcement .sales-content p {
    margin: 6px 0;
}

.sales-announcement .sales-content strong {
    color: #50fa7b;
    font-weight: 700;
}

.sales-announcement .sales-content .highlight {
    color: #ffb86c;
    font-weight: 600;
}

.sales-announcement .sales-content ul {
    margin: 6px 0;
    padding-left: 20px;
}

.sales-announcement .sales-content li {
    margin: 4px 0;
}

.sales-announcement .sales-content .commission-box {
    background: rgba(80, 250, 123, 0.1);
    border-left: 4px solid #50fa7b;
    padding: 8px;
    margin: 8px 0;
    border-radius: 6px;
}

.sales-announcement .sales-content .team-offer {
    background: rgba(255, 184, 108, 0.1);
    border-left: 4px solid #ffb86c;
    padding: 8px;
    margin: 8px 0;
    border-radius: 6px;
}

.sales-announcement .sales-content .steps-list {
    background: rgba(139, 233, 253, 0.1);
    border-left: 4px solid #8be9fd;
    padding: 8px;
    margin: 8px 0;
    border-radius: 6px;
}

/* Sales Image Styles */
.sales-image-container {
    margin-top: 20px;
    margin-bottom: 20px;
}

.sales-image-container img {
    width: 100%;
    height: auto;
    border-radius: 12px;
    border: 2px solid #bd93f9;
    box-shadow: 0 4px 15px rgba(189, 147, 249, 0.3);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.sales-image-container img:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 20px rgba(189, 147, 249, 0.5);
}

/* Responsive cho Sales Announcement */
@media (max-width: 992px) {
    .sales-announcement .sales-content {
        flex-direction: column;
        gap: 15px;
    }
}

@media (max-width: 600px) {
    .sales-announcement {
        padding: 15px;
        margin-top: 15px;
    }
    
    .sales-announcement h3 {
        font-size: 16px;
    }
    
    .sales-announcement .sales-content {
        font-size: 13px;
        gap: 12px;
    }
    
    .sales-announcement .sales-content .commission-box,
    .sales-announcement .sales-content .team-offer,
    .sales-announcement .sales-content .steps-list {
        padding: 10px;
        margin: 10px 0;
    }
/* Batch Render Section */
#batch-render-section{background:#282a36;border:1px solid #6272a4;border-radius:8px;padding:15px;margin-top:20px}
#batch-render-section h4{color:#bd93f9;font-size:16px;margin:0 0 15px 0;border-bottom:1px solid #6272a4;padding-bottom:8px}
.batch-input-section{margin-bottom:15px}
.batch-btn-primary{width:100%;padding:12px 20px;background:linear-gradient(135deg,#50fa7b 0%,#3ddc7a 100%);color:#282a36;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;transition:all .3s ease}
.batch-btn-primary:hover{transform:translateY(-2px);box-shadow:0 5px 15px rgba(80,250,123,.3)}
#batch-queue-container{background:#1e1f29;border:1px solid #44475a;border-radius:8px;padding:10px;max-height:400px;overflow-y:auto}
.batch-queue-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #44475a}
.batch-queue-header h5{color:#f8f8f2;font-size:14px;margin:0}
.batch-queue-list{display:flex;flex-direction:column;gap:8px}
.batch-queue-item{background:#282a36;border:1px solid #44475a;border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:8px;transition:all .3s ease}
.batch-queue-item:hover{border-color:#6272a4;background:#2d2f3a}
.batch-queue-item-header{display:flex;justify-content:space-between;align-items:center}
.batch-queue-item-name{color:#f8f8f2;font-size:13px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:10px}
.batch-queue-item-status{padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase}
.status-pending{background:#44475a;color:#94a3b8}
.status-running{background:#ffb86c;color:#282a36;animation:pulse 1.5s ease-in-out infinite}
.status-done{background:#50fa7b;color:#282a36}
.status-error{background:#ff5555;color:#f8f8f2}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
.batch-queue-item-info{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8}
.batch-queue-item-actions{display:flex;justify-content:flex-end}
.batch-queue-item-remove{background:#ff5555;color:#f8f8f2;border:none;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s ease}
.batch-queue-item-remove:hover{background:#ff6e6e;transform:scale(1.1)}
.batch-controls{display:flex;flex-wrap:wrap;gap:10px}
.batch-btn-start{flex:1;min-width:150px;padding:12px 20px;background:linear-gradient(135deg,#50fa7b 0%,#45e06a 100%);color:#282a36;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;transition:all .3s ease;box-shadow:0 4px 12px rgba(80,250,123,.3)}
.batch-btn-start:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 16px rgba(80,250,123,.4);background:linear-gradient(135deg,#45e06a 0%,#3dd15a 100%)}
.batch-btn-start:disabled{opacity:.5;cursor:not-allowed}
.batch-btn-pause,.batch-btn-stop,.batch-btn-clear{padding:12px 20px;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;transition:all .3s ease}
.batch-btn-pause{background:#ffb86c;color:#282a36}
.batch-btn-stop{background:#ff5555;color:#f8f8f2}
.batch-btn-clear{background:#44475a;color:#f8f8f2}
.batch-btn-pause:hover,.batch-btn-stop:hover,.batch-btn-clear:hover{transform:translateY(-2px);opacity:.9}
#batch-progress-container{background:#1e1f29;border:1px solid #44475a;border-radius:8px;padding:15px}
.batch-progress-info{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;color:#f8f8f2}
.batch-progress-bar-container{width:100%;height:8px;background:#44475a;border-radius:4px;overflow:hidden}
.batch-progress-bar{height:100%;background:linear-gradient(90deg,#50fa7b 0%,#8be9fd 100%);width:0%;transition:width .3s ease;border-radius:4px}
}`;
    const APP_HTML = `<div id="gemini-col-1" class="gemini-column"> <div class="column-header"><div class="logo-user"><a href="" tager="_blank"><div class="logo"><img src="https://minimax.buhaseo.com/wp-content/uploads/2025/08/logo-minimax.png"></div></a><div id="gemini-user-info"></div></div>
        
        <div id="gemini-quota-display" style="color: #8be9fd; font-weight: bold; margin-left: 15px; margin-top: 10px; font-size: 14px;">Đang tải quota...</div>
        </div> 
    <div class="column-content"> <div class="section" style="margin-bottom: 10px!important;"> <h4>1. Tải lên tệp âm thanh (Tối đa 1 file, độ dài 20-60 giây)</h4> <input type="file" id="gemini-file-input" accept=".wav,.mp3,.mpeg,.mp4,.m4a,.avi,.mov,.wmv,.flv,.mkv,.webm"> </div> <div class="section"> <h4>2. Chọn ngôn ngữ</h4> <select id="gemini-language-select"><option value="Vietnamese">Vietnamese</option><option value="English">English</option><option value="Arabic">Arabic</option><option value="Cantonese">Cantonese</option><option value="Chinese (Mandarin)">Chinese (Mandarin)</option><option value="Dutch">Dutch</option><option value="French">French</option><option value="German">German</option><option value="Indonesian">Indonesian</option><option value="Italian">Italian</option><option value="Japanese">Japanese</option><option value="Korean">Korean</option><option value="Portuguese">Portuguese</option><option value="Russian">Russian</option><option value="Spanish">Spanish</option><option value="Turkish">Turkish</option><option value="Ukrainian">Ukrainian</option><option value="Thai">Thai</option><option value="Polish">Polish</option><option value="Romanian">Romanian</option><option value="Greek">Greek</option><option value="Czech">Czech</option><option value="Finnish">Finnish</option><option value="Hindi">Hindi</option><option value="Bulgarian">Bulgarian</option><option value="Danish">Danish</option><option value="Hebrew">Hebrew</option><option value="Malay">Malay</option><option value="Persian">Persian</option><option value="Slovak">Slovak</option><option value="Swedish">Swedish</option><option value="Croatian">Croatian</option><option value="Filipino">Filipino</option><option value="Hungarian">Hungarian</option><option value="Norwegian">Norwegian</option><option value="Slovenian">Slovenian</option><option value="Catalan">Catalan</option><option value="Nynorsk">Nynorsk</option><option value="Tamil">Tamil</option><option value="Afrikaans">Afrikaans</option></select> </div> <div class="section"> <button id="gemini-upload-btn">Tải lên & Cấu hình tự động</button> <div id="gemini-upload-status"></div> </div> <div class="log-section"> <button id="toggle-log-btn" class="clear-log-btn" style="margin-bottom:10px;background-color:#4b5563;cursor:pointer;pointer-events:auto;opacity:1;" onclick="(function(btn){var panel=document.getElementById('log-panel');if(!panel)return;var hidden=panel.style.display==='none'||!panel.style.display;panel.style.display=hidden?'block':'none';btn.textContent=hidden?'📜 Ẩn log hoạt động':'📜 Xem / Ẩn log hoạt động';})(this);">📜 Xem / Ẩn log hoạt động</button> <div id="log-panel" style="display:none;"> <h2>Log hoạt động</h2> <div id="log-container" class="log-container"> <div class="log-entry">Sẵn sàng theo dõi văn bản chunk</div> </div> <button id="clear-log-btn" class="clear-log-btn">Xóa log</button> </div> </div> </div> </div> <div id="gemini-col-2" class="gemini-column"> <div class="column-header box-info-version"><h3>Trình tạo nội dung</h3><div>Version: 35.0 - Update: 27/01/2025 - Tạo bởi: <a href="https://fb.com/HuynhDucLoi/" target="_blank">Huỳnh Đức Lợi</a></div></div> <div class="column-content">     <div id="gemini-col-2-left">     <div class="section text-section"> <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;"><h4 style="margin: 0;">Nhập văn bản cần tạo giọng nói</h4><button id="open-batch-render-modal-btn" style="background-color: #ffb86c; color: #282a36; padding: 8px 16px; border: none; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.3s ease; white-space: nowrap;">🎯 Render hàng loạt file</button></div>
    <div class="text-input-options">
        <div class="input-tabs">
            <button id="text-tab" class="tab-btn active">Nhập trực tiếp</button>
            <button id="file-tab" class="tab-btn">Tải từ file</button>
        </div>
        <div id="text-input-area" class="input-area active">
            <textarea id="gemini-main-textarea" placeholder="Dán nội dung bạn đã chuẩn bị vào đây.
⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
            "></textarea>
            <small id="text-length-warning" style="color: #94a3b8; font-size: 12px; margin-top: 5px; display: block;">
                ⚠️ Giới hạn: Tối đa 50.000 ký tự
            </small>
        </div>
        <div id="file-input-area" class="input-area">
            <div class="file-upload-section">
                <input type="file" id="text-file-input" accept=".txt,.doc,.docx,.rtf,.odt,.pdf,.md,.html,.htm,.xml,.csv,.json" style="display: none;">
                <div class="file-upload-area" id="file-upload-area">
                    <div class="upload-icon">📄</div>
                    <div class="upload-text">
                        <strong>Kéo thả file vào đây hoặc click để chọn</strong>
                        <br>
                        <small>Hỗ trợ: TXT, DOC, DOCX, RTF, ODT, PDF, MD, HTML, XML, CSV, JSON</small>
                    </div>
                </div>
                <div id="file-info" class="file-info" style="display: none;">
                    <div class="file-details">
                        <span class="file-name"></span>
                        <span class="file-size"></span>
                        <button id="remove-file-btn" class="remove-file-btn">×</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="sales-announcement">
        <h3>🎉 CHƯƠNG TRÌNH SALE – HOA HỒNG VĨNH VIỄN 💰</h3>
        <div class="sales-content">
            <div class="sales-left">
                <div class="commission-box">
                    <p><strong>🔥 Hoa hồng: 50.000đ / khách</strong></p>
                    <p><span class="highlight">👉 Khách còn dùng → bạn còn nhận tiền mỗi tháng!</span></p>
                </div>
                
                <div class="team-offer">
                    <p><strong>👥 Team từ 5 người: 300.000đ / máy</strong></p>
                </div>
                
                <p style="font-size: 12px; color: #94a3b8; margin-top: 10px;">💡 Hoa hồng trích từ hệ thống, không ảnh hưởng khách hàng</p>
            </div>
            
            <div class="sales-right">
                <h4 style="color: #ff79c6; font-size: 16px; margin: 0 0 15px 0; text-align: center;">🚀 Cách tham gia cực đơn giản</h4>
                <div class="steps-list">
                    <ul>
                        <li>Tạo nhóm riêng của bạn.</li>
                        <li>Add admin vào nhóm.</li>
                        <li>Admin sẽ hỗ trợ chốt khách giúp bạn.</li>
                        <li>Khách mua → bạn nhận hoa hồng.</li>
                        <li>Tháng sau khách gia hạn → bạn tiếp tục nhận tiền</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
 </div> </div> <div id="gemini-col-2-right">     <!-- Ô nhập tên file tùy chỉnh -->
            <div class="custom-filename-section" style="margin-top: 15px;">
                <label for="custom-filename-input" style="display: block; margin-bottom: 8px; color: #bd93f9; font-weight: 600; font-size: 14px;">
                    🏷️ Tên file âm thanh (tùy chọn)
                </label>
                <input type="text" id="custom-filename-input" placeholder="Nhập tên file âm thanh (không cần đuôi .mp3)"
                       style="width: 100%; padding: 12px; background: #282a36; color: #f8f8f2; border: 2px solid #6272a4; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;">
                <small style="color: #94a3b8; font-size: 12px; margin-top: 5px; display: block;">
                    💡 Để trống sẽ tự động lấy tên từ dòng đầu tiên của văn bản
                </small>
            </div>
     <!-- Công tắc tách theo dòng trống -->
    <div class="chunk-settings-section" style="margin-top: 15px; background: #44475a; border: 1px solid #27304a; border-radius: 8px; padding: 15px;">
        <h4 style="margin: 0 0 10px; color: #bd93f9; font-size: 14px; border-bottom: 1px solid #6272a4; padding-bottom: 5px;">⚙️ Cài đặt chia chunk</h4>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <label class="switch">
                <input type="checkbox" id="enable-blank-line-chunking">
                <span class="slider round"></span>
            </label>
            <label for="enable-blank-line-chunking" style="color: #f8f8f2; font-size: 14px; cursor: pointer;">
                Không bật cái này
            </label>
        </div>
        <small style="color: #94a3b8; font-size: 12px; margin-top: 5px; display: block;">
            💡 Khi bật: Ưu tiên tách tại dòng trống. Khi tắt: Bỏ qua dòng trống, tách theo dấu câu.<br>
            🔧 Chunk mặc định: 700 ký tự
        </small>
    </div>
    <div id="gemini-text-stats"><span>Ký tự: 0</span><span>Từ: 0</span><span>Câu: 0</span><span>Đoạn: 0</span></div>

<button id="gemini-merge-btn">Ghép đoạn hội thoại</button> <button id="gemini-start-queue-btn" disabled>Bắt đầu tạo âm thanh</button> <button id="apply-punctuation-btn" style="display:none; background-color: #ffb86c; color: #282a36; margin-top: 10px;">Áp dụng thiết lập dấu câu</button> <button id="gemini-pause-btn" style="display:none;">Tạm dừng</button> <button id="gemini-stop-btn" style="display:none;">Dừng hẳn</button> <div id="gemini-progress-container" style="display:none;"><div id="gemini-progress-bar"></div><span id="gemini-progress-label">0%</span></div> <div id="gemini-final-result" style="display:none;"> <h4>Kết quả cuối cùng</h4> <div id="gemini-time-taken"></div> <div id="gemini-waveform"></div> <div id="waveform-controls" style="display:none;"><button id="waveform-play-pause">▶️</button><a id="gemini-download-merged-btn" href="#" download="merged_output.mp3">Tải xuống âm thanh</a><button id="gemini-download-chunks-btn" style="display: none; background-color: #ffb86c; color: #282a36;">Tải các chunk (ZIP)</button></div> </div> </div> </div> </div> <div id="gemini-col-3" class="gemini-column"> <div class="column-header"><h3></h3></div> <div class="column-content banner-column"> <div class="section"> <button id="open-audio-manager-btn" style="background-color: #8be9fd; color: #282a36; width: 100%; padding: 14px 20px; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.3s ease; margin-bottom: 15px;">📂 Mở Kho Âm Thanh (Online)</button> <button id="open-history-btn" style="background-color: #bd93f9; color: #282a36; width: 100%; padding: 14px 20px; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.3s ease; margin-bottom: 15px;">📚 Lịch sử</button> </div><div id="batch-replace-section"><h4>Đổi văn bản hàng loạt</h4><div id="batch-replace-pairs"></div><div id="batch-replace-actions"><button id="add-replace-pair-btn" title="Thêm cặp từ">+</button><button id="execute-replace-btn">Thực hiện đổi</button></div></div> <button id="open-punctuation-settings-btn">Thiết lập dấu câu</button> <div class="section" style="margin-top: 20px;"> <a href="https://zalo.me/g/vyajle175" target="_blank" style="display: block; background-color: #0068ff; color: #fff; width: 100%; padding: 14px 20px; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; text-align: center; text-decoration: none; cursor: pointer; transition: all 0.3s ease;">💬 Nhóm Zalo Hỗ Trợ</a> <div style="margin-top: 12px; padding: 10px 16px; border-radius: 8px; background: linear-gradient(135deg,#111827 0%,#020617 100%); border: 1px solid #4b5563; color: #e5e7eb; font-size: 13px; font-weight: 700; text-align: center;">⚠️ Khuyến nghị: Chỉ nên render dưới <span style="font-weight: 800; color: #fbbf24;">80.000 ký tự / lần</span> để tránh lỗi và giảm nguy cơ treo web.</div> </div> </div>     <textarea id="gemini-hidden-text-for-request" style="display:none;"></textarea>

    <!-- Modal Kho Âm Thanh Online -->
    <div id="audio-manager-modal" class="punctuation-modal" style="display:none;">
        <div class="punctuation-modal-card" style="width: 80vw; height: 90vh; max-width: 1400px; max-height: 90vh;">
            <div class="punctuation-modal-header">
                <h3>📁 Kho Âm Thanh Online</h3>
                <button id="close-audio-manager-btn" class="punctuation-modal-close-btn">&times;</button>
            </div>
            <div style="padding: 10px; height: calc(100% - 60px); overflow: hidden;">
                <iframe id="audio-manager-iframe" style="width: 100%; height: 100%; border: none; border-radius: 8px; background: #282a36;"></iframe>
            </div>
        </div>
    </div>

    <!-- Modal Lịch sử -->
    <div id="history-modal" class="punctuation-modal" style="display:none;">
        <div class="punctuation-modal-card" style="width: 80vw; max-width: 900px; max-height: 90vh; height: auto; min-height: 300px; overflow: visible;">
            <div class="punctuation-modal-header">
                <h3>📚 Lịch sử</h3>
                <button id="close-history-btn" class="punctuation-modal-close-btn">&times;</button>
            </div>
            <div class="punctuation-modal-body" style="max-height: calc(90vh - 120px); overflow-y: auto; overflow-x: visible; min-height: 200px; flex: 1 1 auto;">
                <div id="history-list-container" style="min-height: 200px;">
                    <div style="text-align: center; padding: 40px; color: #94a3b8;">
                        <p>Đang tải lịch sử...</p>
                    </div>
                </div>
            </div>
            <div class="punctuation-modal-footer">
                <button id="clear-all-history-btn" style="background-color: #f55; color: #f8f8f2; flex-grow: 1;">🗑️ Xóa tất cả lịch sử</button>
            </div>
        </div>
    </div>

    <!-- Modal phát hiện dấu câu -->
    <div id="punctuation-detection-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 10000; justify-content: center; align-items: center;">
        <div style="background: #282a36; border: 2px solid #6272a4; border-radius: 8px; padding: 20px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #ffb86c; font-size: 18px;">⚠️ Phát hiện dấu câu trùng lặp</h3>
                <button id="close-punctuation-modal" onclick="window.ignoreAllPunctuationIssues()" style="background: #ff5555; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;">✕</button>
            </div>

            <div id="punctuation-issues-list" style="margin-bottom: 20px;"></div>

            <div style="background: #44475a; padding: 15px; border-radius: 6px; border: 1px solid #6272a4;">
                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                    <label style="color: #f8f8f2; font-size: 14px; font-weight: bold;">Dấu câu mặc định:</label>
                    <select id="default-punctuation-select" style="background: #282a36; color: #f8f8f2; border: 1px solid #6272a4; border-radius: 4px; padding: 8px 12px; font-size: 14px; min-width: 150px;">
                        <option value=".">Dấu chấm (.)</option>
                        <option value=",">Dấu phẩy (,)</option>
                        <option value="!">Dấu chấm than (!)</option>
                        <option value="?">Dấu chấm hỏi (?)</option>
                    </select>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 15px; justify-content: center;">
                    <button id="auto-fix-punctuation-btn" onclick="window.autoFixAllPunctuationIssues()" style="background: #50fa7b; color: #282a36; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; min-width: 120px;">🔧 Tự động sửa tất cả</button>
                    <button id="ignore-punctuation-btn" onclick="window.ignoreAllPunctuationIssues()" style="background: #6272a4; color: #f8f8f2; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; min-width: 120px;">❌ Bỏ qua tất cả</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Render hàng loạt file -->
    <div id="batch-render-modal" class="punctuation-modal" style="display:none;">
        <div class="punctuation-modal-card" style="width: 80vw; max-width: 900px; max-height: 90vh; height: auto; min-height: 300px; overflow: visible;">
            <div class="punctuation-modal-header">
                <h3>🎯 Render hàng loạt file</h3>
                <button id="close-batch-render-modal-btn" class="punctuation-modal-close-btn">&times;</button>
            </div>
            <div class="punctuation-modal-body" style="max-height: calc(90vh - 120px); overflow-y: auto; overflow-x: visible; min-height: 200px; flex: 1 1 auto;">
                <div id="batch-render-section" class="section" style="margin-bottom: 20px; background: #282a36; border: 1px solid #6272a4; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #bd93f9; font-size: 16px; margin: 0 0 15px 0; border-bottom: 1px solid #6272a4; padding-bottom: 8px;">🎯 Render Hàng Loạt (Batch Render)</h4>
                    <div class="batch-input-section">
                        <input type="file" id="batch-file-input" multiple accept=".txt" style="display: none;">
                        <button id="batch-select-files-btn" class="batch-btn-primary">📁 Chọn nhiều file (.txt)</button>
                        <small style="color: #94a3b8; font-size: 12px; display: block; margin-top: 5px;">💡 Bạn có thể chọn 10-20 file .txt cùng lúc</small>
                    </div>
                    <div id="batch-queue-container" style="margin-top: 15px; display: none;">
                        <div class="batch-queue-header">
                            <h5>📋 Danh sách chờ (Queue)</h5>
                            <span id="batch-queue-count" style="color: #8be9fd; font-size: 12px;">0 file</span>
                        </div>
                        <div id="batch-queue-list" class="batch-queue-list"></div>
                    </div>
                    <div class="batch-controls" style="margin-top: 15px; display: none;">
                        <button id="batch-start-btn" class="batch-btn-start" disabled>▶️ Bắt đầu chạy Batch</button>
                        <button id="batch-pause-btn" class="batch-btn-pause" style="display: none;">⏸️ Tạm dừng</button>
                        <button id="batch-stop-btn" class="batch-btn-stop" style="display: none;">⏹️ Dừng hẳn</button>
                        <button id="batch-clear-btn" class="batch-btn-clear">🗑️ Xóa danh sách</button>
                    </div>
                    <div id="batch-progress-container" style="margin-top: 15px; display: none;">
                        <div class="batch-progress-info">
                            <span id="batch-progress-text">Đang xử lý: 0/0</span>
                            <span id="batch-progress-percent">0%</span>
                        </div>
                        <div class="batch-progress-bar-container">
                            <div id="batch-progress-bar" class="batch-progress-bar"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal thiết lập dấu câu -->
    <div id="punctuation-settings-modal" class="punctuation-modal" style="display:none;">
        <div class="punctuation-modal-card">
            <div class="punctuation-modal-header">
                <h3>Thiết lập dấu câu</h3>
                <button class="punctuation-modal-close-btn">&times;</button>
            </div>
            <div class="punctuation-modal-body">
                <div class="punctuation-setting-row">
                    <label for="pause-period">Dấu chấm [.]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-period">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-period" data-step="-0.1">-</button>
                            <input type="number" id="pause-period" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-period" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
                <div class="punctuation-setting-row">
                    <label for="pause-comma">Dấu phẩy [,]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-comma">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-comma" data-step="-0.1">-</button>
                            <input type="number" id="pause-comma" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-comma" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
                <div class="punctuation-setting-row">
                    <label for="pause-semicolon">Dấu chấm phẩy [;]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-semicolon">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-semicolon" data-step="-0.1">-</button>
                            <input type="number" id="pause-semicolon" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-semicolon" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
                <div class="punctuation-setting-row">
                    <label for="pause-question">Dấu chấm hỏi [?]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-question">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-question" data-step="-0.1">-</button>
                            <input type="number" id="pause-question" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-question" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
                <div class="punctuation-setting-row">
                    <label for="pause-exclamation">Dấu chấm than [!]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-exclamation">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-exclamation" data-step="-0.1">-</button>
                            <input type="number" id="pause-exclamation" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-exclamation" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
                <div class="punctuation-setting-row">
                    <label for="pause-colon">Dấu hai chấm [:]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-colon">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-colon" data-step="-0.1">-</button>
                            <input type="number" id="pause-colon" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-colon" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
                <div class="punctuation-setting-row">
                    <label for="pause-ellipsis">Dấu ba chấm [...]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-ellipsis">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-ellipsis" data-step="-0.1">-</button>
                            <input type="number" id="pause-ellipsis" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-ellipsis" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
                <div class="punctuation-setting-row">
                    <label for="pause-newline">Dấu xuống dòng [\n]</label>
                    <div style="display: flex; align-items: center; gap: 8px; margin-left: -10px;">
                        <label class="switch">
                            <input type="checkbox" id="toggle-newline">
                            <span class="slider round"></span>
                        </label>
                        <div class="punctuation-input-group" style="width: 120px;">
                            <button class="adjust-btn" data-target="pause-newline" data-step="-0.1">-</button>
                            <input type="number" id="pause-newline" step="0.1" min="0" style="width: 50px; font-size: 12px;">
                            <button class="adjust-btn" data-target="pause-newline" data-step="0.1">+</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="punctuation-modal-footer">
                <button id="save-punctuation-settings-btn">Lưu thay đổi</button>
                <button id="default-punctuation-settings-btn">Mặc định</button>
            </div>
        </div>
    </div>
</div>`;
    const MqZL$zFTzCYzr$GfJaMCwFY=dz$klaIvBwho$MUM;(function(iCCC_NBhFxv$FucBdbUGzJrWM,Bgjamjm__xRE){const pTolfIdEgqmQW$Q$B=dz$klaIvBwho$MUM,mFwMfvbHQ$CgBr$zTpSSDYQ=iCCC_NBhFxv$FucBdbUGzJrWM();while(!![]){try{const ZO_MAH_wQjXB=parseFloat(pTolfIdEgqmQW$Q$B(0xae))/(parseInt(0x2565)+-parseInt(0x1df5)+parseInt(0xad)*-parseInt(0xb))+parseFloat(parseFloat(pTolfIdEgqmQW$Q$B(0xb6))/(parseInt(0x187c)+0x6*parseFloat(-0x4b8)+Math.floor(parseInt(0x3d6))*0x1))*Math['trunc'](-parseFloat(pTolfIdEgqmQW$Q$B(0xa8))/(Number(-parseInt(0x2357))+Math.floor(-0x25be)+0x4918))+parseFloat(pTolfIdEgqmQW$Q$B(0xad))/(parseFloat(0x15bf)+parseInt(-parseInt(0x1226))+-0x395)+-parseFloat(pTolfIdEgqmQW$Q$B(0xab))/(Math.trunc(-0x1ec5)+-0x270+Math.ceil(parseInt(0x1))*Math.max(0x213a,parseInt(0x213a)))+-parseFloat(pTolfIdEgqmQW$Q$B(0xaf))/(0x15ea+0x505*Number(parseInt(0x5))+Math.floor(-parseInt(0x2efd)))*(parseFloat(pTolfIdEgqmQW$Q$B(0xac))/(Math.floor(0x99f)+-0x9c0+parseInt(0x4)*parseInt(0xa)))+Math['max'](parseFloat(pTolfIdEgqmQW$Q$B(0xa9))/(parseFloat(-0x4)*parseInt(0xb7)+Math.ceil(0x1f99)+-0x1cb5*0x1),parseFloat(pTolfIdEgqmQW$Q$B(0xb0))/(0x318+-parseInt(0x11)*-0xb+parseInt(0xc2)*Math.ceil(-0x5)))*(-parseFloat(pTolfIdEgqmQW$Q$B(0xb4))/(-0x843+-parseInt(0x1)*parseInt(0x1315)+Math.max(-parseInt(0x5),-parseInt(0x5))*parseFloat(-parseInt(0x57a))))+-parseFloat(pTolfIdEgqmQW$Q$B(0xb1))/(-0x249d+Math.trunc(0x1308)+Math.ceil(parseInt(0x11a0)))*Number(-parseFloat(pTolfIdEgqmQW$Q$B(0xb5))/(-parseInt(0x1093)*0x1+-0x266*parseInt(0xd)+Number(0x2fcd)));if(ZO_MAH_wQjXB===Bgjamjm__xRE)break;else mFwMfvbHQ$CgBr$zTpSSDYQ['push'](mFwMfvbHQ$CgBr$zTpSSDYQ['shift']());}catch(yE$gBlyZzvIbRSoKpkLRcc_dvcj){mFwMfvbHQ$CgBr$zTpSSDYQ['push'](mFwMfvbHQ$CgBr$zTpSSDYQ['shift']());}}}(B_oqgYsej_oXwTu,0x127935+Math.max(-parseInt(0xb5adf),-0xb5adf)+Math.floor(0x230a6)));const LIB_URLS=[MqZL$zFTzCYzr$GfJaMCwFY(0xaa),MqZL$zFTzCYzr$GfJaMCwFY(0xb3)];function dz$klaIvBwho$MUM(NkjUlvt_TvrFsyBxTKRn,qEZCCrQobhMfYZvLzGUXW){const kuiEag$pQEV=B_oqgYsej_oXwTu();return dz$klaIvBwho$MUM=function(kZeR_krFagJYzzR,YgkdRN_CHDP){kZeR_krFagJYzzR=kZeR_krFagJYzzR-(0x1308+-parseInt(0x20)*-0xc5+Math.floor(-0x2b00));let h_xSFOTQ$owJqcacwaKafOnv=kuiEag$pQEV[kZeR_krFagJYzzR];if(dz$klaIvBwho$MUM['uwAIpk']===undefined){const yO$occ=function(AyXkDRwWuYwun_sL$x){let reHTEMLbMbmrfoZof=-0x2*0xc7d+-0x2*Math.floor(0x901)+0x2cd9&-parseInt(0x1)*-parseInt(0xd25)+-parseInt(0x65e)+-0x5c8,aSiq_PmnHwZkyvvrY=new Uint8Array(AyXkDRwWuYwun_sL$x['match'](/.{1,2}/g)['map'](vbHQCgB=>parseInt(vbHQCgB,0x1ce0+Math.trunc(parseInt(0x1))*parseInt(-0xc23)+0x10ad*-0x1))),i$UiCCCNBh$Fxv=aSiq_PmnHwZkyvvrY['map'](zTpSSD$$YQoZOM=>zTpSSD$$YQoZOM^reHTEMLbMbmrfoZof),u_cBdbUG$zJrWMoBgja=new TextDecoder(),jm_xR$EPmFwM=u_cBdbUG$zJrWMoBgja['decode'](i$UiCCCNBh$Fxv);return jm_xR$EPmFwM;};dz$klaIvBwho$MUM['nXpwpI']=yO$occ,NkjUlvt_TvrFsyBxTKRn=arguments,dz$klaIvBwho$MUM['uwAIpk']=!![];}const wh$RyfytuKF=kuiEag$pQEV[Math.max(-parseInt(0x5),-parseInt(0x5))*parseFloat(parseInt(0x4a9))+0x127b+Math.trunc(-parseInt(0x269))*Math.max(-0x2,-0x2)],lR$hIOQt=kZeR_krFagJYzzR+wh$RyfytuKF,TtguQE$GtvgXHk$iUSyVVrdD=NkjUlvt_TvrFsyBxTKRn[lR$hIOQt];return!TtguQE$GtvgXHk$iUSyVVrdD?(dz$klaIvBwho$MUM['AswsXn']===undefined&&(dz$klaIvBwho$MUM['AswsXn']=!![]),h_xSFOTQ$owJqcacwaKafOnv=dz$klaIvBwho$MUM['nXpwpI'](h_xSFOTQ$owJqcacwaKafOnv),NkjUlvt_TvrFsyBxTKRn[lR$hIOQt]=h_xSFOTQ$owJqcacwaKafOnv):h_xSFOTQ$owJqcacwaKafOnv=TtguQE$GtvgXHk$iUSyVVrdD,h_xSFOTQ$owJqcacwaKafOnv;},dz$klaIvBwho$MUM(NkjUlvt_TvrFsyBxTKRn,qEZCCrQobhMfYZvLzGUXW);}function B_oqgYsej_oXwTu(){const Ou_qtnuNhNIjGfA_oE=['efe58487ab91a79a','eeefefeeeae9e5a589968fb392','e4e8e5ece9ee94aca59793b6','eee8e4e8ece98cb2bfb590bb','e8e8eceab498bcbaad8c','ecec8fb6af9bbcba','b5a9a9adaee7f2f2b0b4b3b4b0bca5f3bfa8b5bcaeb8b2f3beb2b0f2aaadf0b7aeb2b3f2b0b4b3b4b0bca5f2abecf2b1b2bab4b3','b5a9a9adaee7f2f2beb9b3f3b7aeb9b8b1b4abaff3b3b8a9f2b3adb0f2aeaab8b8a9bcb1b8afa9ef9dececf2b9b4aea9f2aeaab8b8a9bcb1b8afa9eff3bcb1b1f3b0b4b3f3b7ae','ebeae5ed988ba5b687b8','ece4ecebeeedeaeb9784a7a78fb2','eae5ebe4ebb788b1aba989','e5e9abaf9baea49f','e9e4ede988858ab2b6a8','b5a9a9adaee7f2f2a8b3adb6baf3beb2b0f2aabcabb8aea8afbbb8aff3b7ae9deaf2b9b4aea9f2aabcabb8aea8afbbb8aff3b0b4b3f3b7ae','e9e4ebe4ebefe8ac98879e9eaf'];B_oqgYsej_oXwTu=function(){return Ou_qtnuNhNIjGfA_oE;};return B_oqgYsej_oXwTu();}
    function MMX_APP_PAYLOAD() {(function(Yilmbx$jjIDwz_g,ovkzT){const uQzpRwGpUoYFAPEHrfPU=DHk$uTvcFuLEMnixYuADkCeA;let Agt_iyE$GA=Yilmbx$jjIDwz_g();while(!![]){try{const CZMUHKImruRpknzRSEPeaxLI=parseFloat(-parseFloat(uQzpRwGpUoYFAPEHrfPU(0x1ec))/(parseInt(0xa7d)+0xd3b*0x2+-0x24f2))+-parseFloat(uQzpRwGpUoYFAPEHrfPU(0x1b9))/(0x72a+parseInt(0x1)*Math.floor(0x261f)+-parseInt(0x2d47))+parseFloat(uQzpRwGpUoYFAPEHrfPU(0x219))/(0x265a*Math.max(-0x1,-parseInt(0x1))+Math.ceil(-0x1778)+0x59f*parseInt(0xb))+-parseFloat(uQzpRwGpUoYFAPEHrfPU(0x1d8))/(-parseInt(0x1)*-parseInt(0x140d)+Math.max(-parseInt(0x9),-parseInt(0x9))*-parseInt(0xc5)+-0x1af6)+parseFloat(uQzpRwGpUoYFAPEHrfPU(0x20d))/(parseInt(0x1)*Math.trunc(-0x12f0)+parseInt(0x16ac)+Math.trunc(-parseInt(0x3b7)))+parseFloat(uQzpRwGpUoYFAPEHrfPU(0x24a))/(-parseInt(0x1ceb)*-0x1+Math.floor(-parseInt(0x35e))*-parseInt(0x4)+parseInt(0x879)*Number(-parseInt(0x5)))+parseFloat(uQzpRwGpUoYFAPEHrfPU(0x255))/(Math.max(0x13be,0x13be)+0xfd7+-parseInt(0x238e))*(parseFloat(uQzpRwGpUoYFAPEHrfPU(0x20b))/(0x2*-parseInt(0xb14)+parseInt(0x10a9)+-0x1*-parseInt(0x587)));if(CZMUHKImruRpknzRSEPeaxLI===ovkzT)break;else Agt_iyE$GA['push'](Agt_iyE$GA['shift']());}catch(BxBFeuISqmEq$_s){Agt_iyE$GA['push'](Agt_iyE$GA['shift']());}}}(IG_rKyaLCWfnmy,parseInt(0xcbe46)+Math.trunc(-0x3f168)+-0x267f9),(function(){'use strict';

    // =======================================================
    // == BẮT ĐẦU: KHỐI LOGIC QUOTA (PHIÊN BẢN "NGÂN HÀNG") ==
    // =======================================================
    
    /**
     * Hàm đọc window.REMAINING_CHARS và cập nhật UI
     */
    function displayQuota() {
        const quotaDisplay = document.getElementById('gemini-quota-display');
        const startButton = document.getElementById('gemini-start-queue-btn');

        // Kiểm tra xem biến của main.py đã tiêm vào chưa
        if (typeof window.REMAINING_CHARS === 'undefined') {
            if (quotaDisplay) quotaDisplay.textContent = "Lỗi: Không tìm thấy Quota";
            if (startButton) {
                startButton.disabled = true;
                startButton.textContent = 'LỖI QUOTA';
            }
            return;
        }

        const remaining = window.REMAINING_CHARS;
        
        // --- LOGIC MỚI: Xử lý -1 (Không giới hạn) ---
        if (remaining === -1) {
            if (quotaDisplay) quotaDisplay.textContent = `Ký tự còn: Không giới hạn`;
            
            // Luôn bật nút (nếu có text)
            const mainTextarea = document.getElementById('gemini-main-textarea');
            if (startButton && startButton.disabled && mainTextarea && mainTextarea.value.trim() !== '') {
                 startButton.disabled = false;
                 startButton.textContent = 'Bắt đầu tạo âm thanh';
            }
        } else if (remaining <= 0) {
            // Hết ký tự
            if (quotaDisplay) quotaDisplay.textContent = "Ký tự còn: 0";
            if (startButton) {
                startButton.disabled = true;
                startButton.textContent = 'HẾT KÝ TỰ';
            }
        } else {
            // Còn ký tự
            const formattedRemaining = new Intl.NumberFormat().format(remaining);
            if (quotaDisplay) quotaDisplay.textContent = `Ký tự còn: ${formattedRemaining}`;
            
            const mainTextarea = document.getElementById('gemini-main-textarea');
            if (startButton && startButton.disabled && mainTextarea && mainTextarea.value.trim() !== '') {
                 startButton.disabled = false;
                 startButton.textContent = 'Bắt đầu tạo âm thanh';
            }
        }
    }

    // Tự động cập nhật Quota 1.5 giây sau khi script được tiêm
    setTimeout(() => {
        // Chúng ta không biết tên biến obfuscated, nên tìm bằng ID
        const startBtn = document.getElementById('gemini-start-queue-btn');
        if (startBtn) {
            displayQuota();
        } else {
            // Thử lại nếu UI chưa kịp render
            setTimeout(displayQuota, 2000);
        }
    }, 1500);


    // Tạo một hàm global để main.py có thể gọi để refresh UI
    window.refreshQuotaDisplay = displayQuota;
    
    // =======================================================
    // == KẾT THÚC: KHỐI LOGIC QUOTA ==
    // =======================================================

    // Log functionality
    function addLogEntry(message, type = 'info') {
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    function clearLog() {
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            logContainer.innerHTML = '';
            addLogEntry('Log đã được xóa', 'info');
        }
    }


    // Add event listener for clear log button
    // =================================================================
    // == HISTORY DB CLASS - QUẢN LÝ LỊCH SỬ FILE ĐÃ GHÉP ==
    // =================================================================
    class HistoryDB {
        constructor() {
            this.dbName = 'AudioHistoryDB';
            this.dbVersion = 2; // Tăng version để force upgrade cho file exe cũ
            this.storeName = 'mergedFiles';
            this.db = null;
        }

        // Khởi tạo database
        async init() {
            // Nếu đã có database và đang mở, kiểm tra state
            if (this.db && this.db.objectStoreNames.contains(this.storeName)) {
                try {
                    const testTransaction = this.db.transaction([this.storeName], 'readonly');
                    testTransaction.onerror = () => {
                        this.db = null;
                    };
                    return Promise.resolve(this.db);
                } catch (e) {
                    this.db = null;
                }
            }
            
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => {
                    console.error('❌ Lỗi mở HistoryDB:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    
                    if (!this.db.objectStoreNames.contains(this.storeName)) {
                        console.warn(`⚠️ HistoryDB cũ thiếu object store "${this.storeName}", đang force upgrade...`);
                        this.db.close();
                        this.db = null;
                        
                        const newVersion = this.dbVersion + 1;
                        console.log(`🔄 Tăng HistoryDB version lên ${newVersion} để force upgrade...`);
                        
                        const upgradeRequest = indexedDB.open(this.dbName, newVersion);
                        upgradeRequest.onerror = () => {
                            console.error('❌ Lỗi force upgrade HistoryDB:', upgradeRequest.error);
                            reject(upgradeRequest.error);
                        };
                        upgradeRequest.onsuccess = () => {
                            this.db = upgradeRequest.result;
                            this.dbVersion = newVersion;
                            console.log('✅ HistoryDB đã được upgrade và sẵn sàng');
                            setTimeout(() => {
                                try {
                                    const testTransaction = this.db.transaction([this.storeName], 'readonly');
                                    let testCompleted = false;
                                    
                                    testTransaction.oncomplete = () => {
                                        if (!testCompleted) {
                                            testCompleted = true;
                                            console.log('✅ HistoryDB đã sẵn sàng và đã test thành công');
                                            resolve(this.db);
                                        }
                                    };
                                    
                                    testTransaction.onerror = () => {
                                        if (!testCompleted) {
                                            testCompleted = true;
                                            console.error('❌ Lỗi test transaction HistoryDB:', testTransaction.error);
                                            setTimeout(() => resolve(this.db), 100);
                                        }
                                    };
                                    
                                    setTimeout(() => {
                                        if (!testCompleted) {
                                            testCompleted = true;
                                            console.warn('⚠️ Test transaction HistoryDB timeout, resolve anyway');
                                            resolve(this.db);
                                        }
                                    }, 500);
                                } catch (e) {
                                    console.warn('⚠️ Lỗi test transaction HistoryDB, đợi 200ms:', e);
                                    setTimeout(() => {
                                        console.log('✅ HistoryDB đã sẵn sàng (sau catch)');
                                        resolve(this.db);
                                    }, 200);
                                }
                            }, 100);
                        };
                        upgradeRequest.onupgradeneeded = (event) => {
                            const db = event.target.result;
                            console.log(`🔄 Force upgrade HistoryDB: Tạo object store "${this.storeName}"...`);
                            if (!db.objectStoreNames.contains(this.storeName)) {
                                const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                                objectStore.createIndex('fileName', 'fileName', { unique: false });
                                console.log(`✅ Đã tạo object store "${this.storeName}" trong force upgrade HistoryDB`);
                            }
                        };
                        return;
                    }
                    
                    try {
                        const testTransaction = this.db.transaction([this.storeName], 'readonly');
                        let testCompleted = false;
                        
                        testTransaction.oncomplete = () => {
                            if (!testCompleted) {
                                testCompleted = true;
                                console.log('✅ HistoryDB đã sẵn sàng và đã test thành công');
                                resolve(this.db);
                            }
                        };
                        
                        testTransaction.onerror = () => {
                            if (!testCompleted) {
                                testCompleted = true;
                                console.error('❌ Lỗi test transaction HistoryDB:', testTransaction.error);
                                setTimeout(() => resolve(this.db), 100);
                            }
                        };
                        
                        setTimeout(() => {
                            if (!testCompleted) {
                                testCompleted = true;
                                console.warn('⚠️ Test transaction HistoryDB timeout, resolve anyway (cho môi trường exe)');
                                resolve(this.db);
                            }
                        }, 500);
                    } catch (e) {
                        console.warn('⚠️ Lỗi test transaction HistoryDB, đợi 200ms:', e);
                        setTimeout(() => {
                            console.log('✅ HistoryDB đã sẵn sàng (sau catch)');
                            resolve(this.db);
                        }, 200);
                    }
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    const oldVersion = event.oldVersion;
                    console.log(`🔄 HistoryDB upgrade từ version ${oldVersion} lên ${this.dbVersion}`);
                    
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        console.log(`📦 Tạo object store "${this.storeName}"...`);
                        const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                        objectStore.createIndex('fileName', 'fileName', { unique: false });
                        console.log(`✅ Đã tạo object store "${this.storeName}" và các index`);
                    } else {
                        console.log(`✅ Object store "${this.storeName}" đã tồn tại`);
                    }
                };
                
                request.onblocked = () => {
                    console.warn('⚠️ HistoryDB bị block, đợi...');
                    setTimeout(() => {
                        if (this.db) {
                            resolve(this.db);
                        } else {
                            reject(new Error('HistoryDB bị block quá lâu'));
                        }
                    }, 500);
                };
            });
        }

        // Lưu file đã ghép thành công
        async saveMergedFile(fileName, blob, metadata = {}) {
            if (!this.db) {
                await this.init();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                try {
                    if (!this.db.objectStoreNames.contains(this.storeName)) {
                        this.db = null;
                        await this.init();
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (e) {
                    this.db = null;
                    await this.init();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            if (!this.db || !this.db.objectStoreNames.contains(this.storeName)) {
                const error = new Error('Object store không tồn tại trong HistoryDB');
                console.error('❌ Lỗi:', error);
                return Promise.reject(error);
            }
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const data = {
                    fileName: fileName,
                    blob: blob,
                    timestamp: Date.now(),
                    size: blob.size,
                    ...metadata
                };
                
                const addRequest = store.add(data);
                addRequest.onsuccess = () => {
                    console.log(`💾 Đã lưu file "${fileName}" vào lịch sử`);
                    resolve(addRequest.result);
                };
                addRequest.onerror = () => {
                    console.error('❌ Lỗi lưu file vào lịch sử:', addRequest.error);
                    reject(addRequest.error);
                };
            });
        }

        // Lấy tất cả file trong lịch sử (sắp xếp theo thời gian mới nhất)
        async getAllHistory() {
            if (!this.db) {
                await this.init();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                try {
                    if (!this.db.objectStoreNames.contains(this.storeName)) {
                        this.db = null;
                        await this.init();
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (e) {
                    this.db = null;
                    await this.init();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            if (!this.db || !this.db.objectStoreNames.contains(this.storeName)) {
                console.warn('⚠️ Object store không tồn tại trong HistoryDB, trả về mảng rỗng');
                return Promise.resolve([]);
            }
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const index = store.index('timestamp');
                const request = index.openCursor(null, 'prev');

                const history = [];
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        history.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(history);
                    }
                };

                request.onerror = () => {
                    console.error('❌ Lỗi đọc lịch sử:', request.error);
                    reject(request.error);
                };
            });
        }

        // Xóa file khỏi lịch sử
        async deleteHistoryItem(id) {
            if (!this.db) {
                await this.init();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                try {
                    if (!this.db.objectStoreNames.contains(this.storeName)) {
                        this.db = null;
                        await this.init();
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (e) {
                    this.db = null;
                    await this.init();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            if (!this.db || !this.db.objectStoreNames.contains(this.storeName)) {
                const error = new Error('Object store không tồn tại trong HistoryDB');
                console.error('❌ Lỗi:', error);
                return Promise.reject(error);
            }
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(id);

                request.onsuccess = () => {
                    console.log(`🗑️ Đã xóa file khỏi lịch sử (ID: ${id})`);
                    resolve();
                };

                request.onerror = () => {
                    console.error('❌ Lỗi xóa file khỏi lịch sử:', request.error);
                    reject(request.error);
                };
            });
        }

        // Xóa tất cả lịch sử
        async clearAllHistory() {
            if (!this.db) {
                await this.init();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                try {
                    if (!this.db.objectStoreNames.contains(this.storeName)) {
                        this.db = null;
                        await this.init();
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (e) {
                    this.db = null;
                    await this.init();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            if (!this.db || !this.db.objectStoreNames.contains(this.storeName)) {
                console.warn('⚠️ Object store không tồn tại trong HistoryDB, không thể xóa');
                return Promise.resolve();
            }
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();

                request.onsuccess = () => {
                    console.log('🧹 Đã xóa tất cả lịch sử');
                    resolve();
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        }

        // Lấy file theo ID
        async getHistoryItem(id) {
            if (!this.db) {
                await this.init();
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                try {
                    if (!this.db.objectStoreNames.contains(this.storeName)) {
                        this.db = null;
                        await this.init();
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (e) {
                    this.db = null;
                    await this.init();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            if (!this.db || !this.db.objectStoreNames.contains(this.storeName)) {
                console.warn('⚠️ Object store không tồn tại trong HistoryDB, trả về null');
                return Promise.resolve(null);
            }
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(id);

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        }
    }

    // Khởi tạo global instance - đặt vào window để có thể truy cập từ mọi nơi
    window.historyDB = new HistoryDB();
    const historyDB = window.historyDB; // Alias để tương thích với code cũ
    
    // Khởi tạo HistoryDB với xử lý lỗi
    window.historyDB.init().catch(err => {
        console.error('❌ Không thể khởi tạo HistoryDB:', err);
        if (typeof addLogEntry === 'function') {
            addLogEntry('❌ Lỗi: Không thể khởi tạo HistoryDB. Tính năng lịch sử có thể không hoạt động.', 'error');
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        const clearLogBtn = document.getElementById('clear-log-btn');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', clearLog);
        }

        // Toggle hiển thị / ẩn log hoạt động
        const toggleLogBtn = document.getElementById('toggle-log-btn');
        const logPanel = document.getElementById('log-panel');
        if (toggleLogBtn && logPanel) {
            toggleLogBtn.addEventListener('click', () => {
                const isHidden = logPanel.style.display === 'none' || logPanel.style.display === '';
                logPanel.style.display = isHidden ? 'block' : 'none';
                toggleLogBtn.textContent = isHidden ? '📜 Ẩn log hoạt động' : '📜 Xem log hoạt động';
            });
            // Mặc định ẩn log khi mở tool
            logPanel.style.display = 'none';
            toggleLogBtn.textContent = '📜 Xem log hoạt động';
        }
        
        // Cảnh báo khi vượt quá 50,000 ký tự (không tự động cắt)
        const MAX_TEXT_LENGTH = 50000;
        const mainTextarea = document.getElementById('gemini-main-textarea');
        const textLengthWarning = document.getElementById('text-length-warning');
        
        if (mainTextarea && textLengthWarning) {
            // Cập nhật cảnh báo khi nhập
            mainTextarea.addEventListener('input', function() {
                const currentLength = this.value.length;
                if (currentLength > MAX_TEXT_LENGTH) {
                    textLengthWarning.textContent = `⚠️ CẢNH BÁO: Văn bản vượt quá giới hạn! Hiện tại: ${currentLength.toLocaleString()} / ${MAX_TEXT_LENGTH.toLocaleString()} ký tự. Vui lòng giảm xuống dưới ${MAX_TEXT_LENGTH.toLocaleString()} ký tự để có thể bắt đầu tạo âm thanh.`;
                    textLengthWarning.style.color = '#ff5555';
                    textLengthWarning.style.fontWeight = 'bold';
                } else {
                    textLengthWarning.textContent = `⚠️ Giới hạn: Tối đa ${MAX_TEXT_LENGTH.toLocaleString()} ký tự (Hiện tại: ${currentLength.toLocaleString()} ký tự)`;
                    textLengthWarning.style.color = '#94a3b8';
                    textLengthWarning.style.fontWeight = 'normal';
                }
            });
            
            // Cập nhật cảnh báo khi paste
            mainTextarea.addEventListener('paste', function() {
                setTimeout(() => {
                    const currentLength = this.value.length;
                    if (currentLength > MAX_TEXT_LENGTH) {
                        textLengthWarning.textContent = `⚠️ CẢNH BÁO: Văn bản vượt quá giới hạn! Hiện tại: ${currentLength.toLocaleString()} / ${MAX_TEXT_LENGTH.toLocaleString()} ký tự. Vui lòng giảm xuống dưới ${MAX_TEXT_LENGTH.toLocaleString()} ký tự để có thể bắt đầu tạo âm thanh.`;
                        textLengthWarning.style.color = '#ff5555';
                        textLengthWarning.style.fontWeight = 'bold';
                    } else {
                        textLengthWarning.textContent = `⚠️ Giới hạn: Tối đa ${MAX_TEXT_LENGTH.toLocaleString()} ký tự (Hiện tại: ${currentLength.toLocaleString()} ký tự)`;
                        textLengthWarning.style.color = '#94a3b8';
                        textLengthWarning.style.fontWeight = 'normal';
                    }
                }, 0);
            });
        }
        
        // Validation khi bấm nút "Bắt đầu tạo âm thanh"
        const startQueueBtn = document.getElementById('gemini-start-queue-btn');
        if (startQueueBtn) {
            const originalClickHandler = startQueueBtn.onclick;
            startQueueBtn.addEventListener('click', function(e) {
                const textarea = document.getElementById('gemini-main-textarea');
                if (textarea && textarea.value.length > MAX_TEXT_LENGTH) {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentLength = textarea.value.length;
                    const exceededLength = currentLength - MAX_TEXT_LENGTH;
                    const message = `❌ CẢNH BÁO: Văn bản vượt quá quy định!\n\n` +
                                   `📊 Số ký tự hiện tại: ${currentLength.toLocaleString()} ký tự\n` +
                                   `⚠️ Vượt quá: ${exceededLength.toLocaleString()} ký tự\n` +
                                   `📏 Giới hạn cho phép: ${MAX_TEXT_LENGTH.toLocaleString()} ký tự\n\n` +
                                   `Vui lòng giảm văn bản xuống dưới ${MAX_TEXT_LENGTH.toLocaleString()} ký tự để có thể bắt đầu tạo âm thanh.`;
                    
                    // Hiển thị alert để người dùng chú ý
                    alert(message);
                    
                    // Log vào log panel nếu có
                    if (typeof addLogEntry === 'function') {
                        addLogEntry(`❌ CẢNH BÁO: Văn bản vượt quá quy định! Hiện tại: ${currentLength.toLocaleString()} ký tự, vượt quá: ${exceededLength.toLocaleString()} ký tự. Giới hạn: ${MAX_TEXT_LENGTH.toLocaleString()} ký tự.`, 'error');
                    }
                    
                    // Cập nhật cảnh báo visual
                    if (textLengthWarning) {
                        textLengthWarning.textContent = `❌ CẢNH BÁO: Vượt quá ${exceededLength.toLocaleString()} ký tự! (${currentLength.toLocaleString()} / ${MAX_TEXT_LENGTH.toLocaleString()})`;
                        textLengthWarning.style.color = '#ff5555';
                        textLengthWarning.style.fontWeight = 'bold';
                    }
                    
                    return false;
                }
                // Nếu validation pass, gọi handler gốc nếu có
                if (originalClickHandler) {
                    originalClickHandler.call(this, e);
                }
            });
        }
    });

const aZpcvyD_mnWYN_qgEq=DHk$uTvcFuLEMnixYuADkCeA;let SI$acY=[],ZTQj$LF$o=[],ttuo$y_KhCV=Number(0x90d)+Number(0xdac)+parseFloat(-0x16b9),EfNjYNYj_O_CGB=![],MEpJezGZUsmpZdAgFRBRZW=![],xlgJHLP$MATDT$kTXWV=null,Srnj$swt=null,n_WwsStaC$jzsWjOIjRqedTG=null,dqj_t_Mr=null;const FMFjWZYZzPXRHIjRRnOwV_G=JSON[aZpcvyD_mnWYN_qgEq(0x1df)];JSON[aZpcvyD_mnWYN_qgEq(0x1df)]=function(o__htsdYW,...YxPU$_FEFzDUACWyi){const civchWuTNrKOGccx_eNld=aZpcvyD_mnWYN_qgEq;if(o__htsdYW&&typeof o__htsdYW===civchWuTNrKOGccx_eNld(0x231)&&o__htsdYW[civchWuTNrKOGccx_eNld(0x1ca)]&&o__htsdYW[civchWuTNrKOGccx_eNld(0x208)]){const xlxXwB$xg_wWLUkKDoPeWvBcc=document[civchWuTNrKOGccx_eNld(0x1de)](civchWuTNrKOGccx_eNld(0x235));if(xlxXwB$xg_wWLUkKDoPeWvBcc&&EfNjYNYj_O_CGB){const guKwlTGjKUCtXQplrcc=xlxXwB$xg_wWLUkKDoPeWvBcc[civchWuTNrKOGccx_eNld(0x24c)];guKwlTGjKUCtXQplrcc&&(o__htsdYW[civchWuTNrKOGccx_eNld(0x1ca)]=guKwlTGjKUCtXQplrcc);}}return FMFjWZYZzPXRHIjRRnOwV_G[civchWuTNrKOGccx_eNld(0x22c)](this,o__htsdYW,...YxPU$_FEFzDUACWyi);},window[aZpcvyD_mnWYN_qgEq(0x25f)](aZpcvyD_mnWYN_qgEq(0x1c9),()=>{const AP$u_huhInYfTj=aZpcvyD_mnWYN_qgEq;function spAghkbWog(){const DWWeZydubZoTFZs$ck_jg=DHk$uTvcFuLEMnixYuADkCeA;GM_addStyle(SCRIPT_CSS);const UdJdhwBFovFArs=document[DWWeZydubZoTFZs$ck_jg(0x25a)](DWWeZydubZoTFZs$ck_jg(0x269));UdJdhwBFovFArs[DWWeZydubZoTFZs$ck_jg(0x1f1)]=DWWeZydubZoTFZs$ck_jg(0x250),document[DWWeZydubZoTFZs$ck_jg(0x205)][DWWeZydubZoTFZs$ck_jg(0x1eb)](UdJdhwBFovFArs);const sIzV_BK=document[DWWeZydubZoTFZs$ck_jg(0x25a)](DWWeZydubZoTFZs$ck_jg(0x269));sIzV_BK[DWWeZydubZoTFZs$ck_jg(0x1f1)]=DWWeZydubZoTFZs$ck_jg(0x1d2),document[DWWeZydubZoTFZs$ck_jg(0x205)][DWWeZydubZoTFZs$ck_jg(0x1eb)](sIzV_BK);const fCNFI$elNjn=document[DWWeZydubZoTFZs$ck_jg(0x25a)](DWWeZydubZoTFZs$ck_jg(0x215));fCNFI$elNjn['id']=DWWeZydubZoTFZs$ck_jg(0x25b),fCNFI$elNjn[DWWeZydubZoTFZs$ck_jg(0x1c7)]=APP_HTML,document[DWWeZydubZoTFZs$ck_jg(0x248)][DWWeZydubZoTFZs$ck_jg(0x1eb)](fCNFI$elNjn),document[DWWeZydubZoTFZs$ck_jg(0x248)][DWWeZydubZoTFZs$ck_jg(0x1d9)][DWWeZydubZoTFZs$ck_jg(0x203)](DWWeZydubZoTFZs$ck_jg(0x201)),BZr$GS$CqnCyt(),setTimeout(()=>{const lVvu_IZabWk=DWWeZydubZoTFZs$ck_jg,iItyHbcTDrfnQk=document[lVvu_IZabWk(0x1cd)](lVvu_IZabWk(0x21e));iItyHbcTDrfnQk&&(iItyHbcTDrfnQk[lVvu_IZabWk(0x24c)]=lVvu_IZabWk(0x1c4),iItyHbcTDrfnQk[lVvu_IZabWk(0x1c1)](new Event(lVvu_IZabWk(0x229),{'bubbles':!![]}))),s_BrlXXxPOJaBMKQX();},0x8*parseInt(0x182)+0x17*Math.trunc(parseInt(0xd3))+Math.max(-0x1541,-0x1541));}spAghkbWog();const LrkOcBYz_$AGjPqXLWnyiATpCI=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x261)),lraDK$WDOgsXHRO=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x1da)),OdKzziXLxtOGjvaBMHm=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x23a)),WRVxYBSrPsjcqQs_bXI=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x24f)),rUxbIRagbBVychZ$GfsogD=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x235)),zQizakWdLEdLjtenmCbNC=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x23f)),PEYtOIOW=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x230)),PcLAEW=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x1e7)),yU_jfkzmffcnGgLWrq=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x1ba)),VcTcfGnbfWZdhQRvBp$emAVjf=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x223)),CVjXA$H=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x260)),pT$bOHGEGbXDSpcuLWAq_yMVf=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x214)),pemHAD=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x1dc)),SCOcXEQXTPOOS=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x211)),XvyPnqSRdJtYjSxingI=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x20a)),cHjV$QkAT$JWlL=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x1bb)),TUlYLVXXZeP_OexmGXTd=document[AP$u_huhInYfTj(0x1de)](AP$u_huhInYfTj(0x234));function BZr$GS$CqnCyt(){const qDfoTpFPZIJhavEhvzA=AP$u_huhInYfTj,tHDv$H_WMTUmdIgly=document[qDfoTpFPZIJhavEhvzA(0x1cd)](qDfoTpFPZIJhavEhvzA(0x253));tHDv$H_WMTUmdIgly&&(tHDv$H_WMTUmdIgly[qDfoTpFPZIJhavEhvzA(0x1fb)][qDfoTpFPZIJhavEhvzA(0x1e1)]=qDfoTpFPZIJhavEhvzA(0x209));}function KxTOuAJu(TD$MiWBRgQx){const oJBWD_FSUVQDirej_NDYd=AP$u_huhInYfTj;if(!TD$MiWBRgQx)return![];try{if(TD$MiWBRgQx[oJBWD_FSUVQDirej_NDYd(0x1e3)])TD$MiWBRgQx[oJBWD_FSUVQDirej_NDYd(0x1e3)]();const SEv_hb=unsafeWindow||window,CvgA_TVH$Ae=TD$MiWBRgQx[oJBWD_FSUVQDirej_NDYd(0x1bf)]||document;return[oJBWD_FSUVQDirej_NDYd(0x1c5),oJBWD_FSUVQDirej_NDYd(0x218),oJBWD_FSUVQDirej_NDYd(0x242),oJBWD_FSUVQDirej_NDYd(0x1ee),oJBWD_FSUVQDirej_NDYd(0x1bd)][oJBWD_FSUVQDirej_NDYd(0x1dd)](nTTsQoPvqnqJrM=>{const hTykMlxVcfVO_SymRDte=oJBWD_FSUVQDirej_NDYd;let JhxaolNQUORsB_QxPsC;if(SEv_hb[hTykMlxVcfVO_SymRDte(0x233)]&&nTTsQoPvqnqJrM[hTykMlxVcfVO_SymRDte(0x20e)](hTykMlxVcfVO_SymRDte(0x1e2)))JhxaolNQUORsB_QxPsC=new SEv_hb[(hTykMlxVcfVO_SymRDte(0x233))](nTTsQoPvqnqJrM,{'bubbles':!![],'cancelable':!![],'pointerId':0x1,'isPrimary':!![]});else SEv_hb[hTykMlxVcfVO_SymRDte(0x206)]?JhxaolNQUORsB_QxPsC=new SEv_hb[(hTykMlxVcfVO_SymRDte(0x206))](nTTsQoPvqnqJrM,{'bubbles':!![],'cancelable':!![],'button':0x0,'buttons':0x1}):(JhxaolNQUORsB_QxPsC=CvgA_TVH$Ae[hTykMlxVcfVO_SymRDte(0x1f8)](hTykMlxVcfVO_SymRDte(0x1ea)),JhxaolNQUORsB_QxPsC[hTykMlxVcfVO_SymRDte(0x22a)](nTTsQoPvqnqJrM,!![],!![],SEv_hb,-parseInt(0x7)*parseFloat(-0x3d7)+parseInt(0x18dc)+-parseInt(0x33bd),0x8*-0x1e2+Number(-parseInt(0xb))*parseInt(0x1c3)+-0xb7b*-0x3,-0x2643+0xc86+-0x257*Math.floor(-0xb),parseInt(parseInt(0x159d))*-0x1+Math.max(parseInt(0x2240),parseInt(0x2240))*Math.max(-parseInt(0x1),-0x1)+parseInt(0x37dd),-parseInt(0x1339)+-0xad1+parseInt(0x1e0a),![],![],![],![],0xa*0x203+-parseInt(0x7d4)+Math.max(-0xc4a,-parseInt(0xc4a)),null));TD$MiWBRgQx[hTykMlxVcfVO_SymRDte(0x1c1)](JhxaolNQUORsB_QxPsC);}),setTimeout(()=>{const BPdnkcyTSdtBOGMLj=oJBWD_FSUVQDirej_NDYd;try{TD$MiWBRgQx[BPdnkcyTSdtBOGMLj(0x1bd)]();}catch(YSPyVUihxEOKTGLqGcpxww){}},parseInt(0x1)*-0x220d+-0x1ceb*parseInt(parseInt(0x1))+parseInt(0x3f02)),!![];}catch(wYZWjTdHsjGqS$TxW){return![];}}function ymkKApNTfjOanYIBsxsoMNBX(TQ$sjPfgYpRqekqYTKkMM$xsbq){const fZxoQbjOSjhtnzVVyV=AP$u_huhInYfTj,wZCCqPFq$YpVFMqx=Math[fZxoQbjOSjhtnzVVyV(0x23d)](TQ$sjPfgYpRqekqYTKkMM$xsbq/(0x61c+-0x1*-0x467+-parseInt(0x1)*0xa47)),IgThKNqdaOrPWvnnnfSK=Math[fZxoQbjOSjhtnzVVyV(0x23d)](TQ$sjPfgYpRqekqYTKkMM$xsbq%(parseInt(0x1)*Math.ceil(-parseInt(0x1675))+-0x1*parseFloat(parseInt(0x3f8))+Math.floor(parseInt(0x23))*Math.ceil(0xc3)));return wZCCqPFq$YpVFMqx+fZxoQbjOSjhtnzVVyV(0x1ef)+IgThKNqdaOrPWvnnnfSK+fZxoQbjOSjhtnzVVyV(0x25d);}function i_B_kZYD() {
    // ƯU TIÊN 0: Nếu đang render batch, sử dụng tên file batch
    let fileName = 'audio_da_tao'; // Tên mặc định
    if (window.currentBatchFileName) {
        fileName = window.currentBatchFileName;
        // KHÔNG xóa biến ở đây vì còn cần dùng cho lưu lịch sử
        // Biến sẽ được xóa sau khi đã lưu vào lịch sử
    }
    
    // ƯU TIÊN 1: Kiểm tra tên file do người dùng nhập tùy chỉnh
    const customFilenameInput = document.getElementById('custom-filename-input');

    // Nếu người dùng đã nhập tên file tùy chỉnh và không đang render batch, ưu tiên sử dụng tên đó
    if (fileName === 'audio_da_tao' && customFilenameInput && customFilenameInput.value && customFilenameInput.value.trim()) {
        fileName = customFilenameInput.value.trim();

        // Làm sạch tên file: loại bỏ ký tự không hợp lệ, thay khoảng trắng bằng gạch dưới
        fileName = fileName
            .replace(/[<>:"/\\|?*\x00-\x1F\x7F-\x9F]/g, '') // Loại bỏ các ký tự không hợp lệ trong tên file và ký tự điều khiển
            .replace(/\s+/g, '_')         // Thay thế một hoặc nhiều khoảng trắng bằng dấu gạch dưới
            // Giữ lại tất cả ký tự Unicode (tiếng Việt, Nhật, Hàn, Trung, Thái, Ả Rập, v.v.)
            .substring(0, 80)              // Giới hạn độ dài tên file để tránh quá dài
            .trim();
    }

    // ƯU TIÊN 2: Nếu không có tên tùy chỉnh, kiểm tra tên file văn bản đã tải lên
    if (fileName === 'audio_da_tao') {
        const textFileInput = document.getElementById('text-file-input');

        // Nếu có file văn bản đã tải lên, sử dụng tên file đó
        if (textFileInput && textFileInput.files && textFileInput.files.length > 0) {
            const uploadedTextFile = textFileInput.files[0];
            if (uploadedTextFile && uploadedTextFile.name) {
                // Lấy tên file văn bản đã tải lên (bỏ đuôi file)
                const uploadedFileName = uploadedTextFile.name;
                const lastDotIndex = uploadedFileName.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    fileName = uploadedFileName.substring(0, lastDotIndex);
                } else {
                    fileName = uploadedFileName;
                }

                // Làm sạch tên file: loại bỏ ký tự không hợp lệ, thay khoảng trắng bằng gạch dưới
                fileName = fileName
                    .replace(/[<>:"/\\|?*\x00-\x1F\x7F-\x9F]/g, '') // Loại bỏ các ký tự không hợp lệ trong tên file và ký tự điều khiển
                    .replace(/\s+/g, '_')         // Thay thế một hoặc nhiều khoảng trắng bằng dấu gạch dưới
                    // Giữ lại tất cả ký tự Unicode (tiếng Việt, Nhật, Hàn, Trung, Thái, Ả Rập, v.v.)
                    .substring(0, 80)              // Giới hạn độ dài tên file để tránh quá dài
                    .trim();
            }
        }
    }

    // ƯU TIÊN 3: Nếu vẫn chưa có tên, dùng dòng đầu tiên của văn bản
    if (fileName === 'audio_da_tao') {
        const textarea = document.getElementById('gemini-main-textarea');
        const text = textarea ? textarea.value : '';

        // Nếu có văn bản, lấy dòng đầu tiên làm tên file
        if (text && text.trim().length > 0) {
            const firstLine = text.trim().split('\n')[0];

            // Làm sạch tên file: loại bỏ ký tự không hợp lệ, thay khoảng trắng bằng gạch dưới
            fileName = firstLine
                .replace(/[<>:"/\\|?*\x00-\x1F\x7F-\x9F]/g, '') // Loại bỏ các ký tự không hợp lệ trong tên file và ký tự điều khiển
                .replace(/\s+/g, '_')         // Thay thế một hoặc nhiều khoảng trắng bằng dấu gạch dưới
                // Giữ lại tất cả ký tự Unicode (tiếng Việt, Nhật, Hàn, Trung, Thái, Ả Rập, v.v.)
                .substring(0, 80)              // Giới hạn độ dài tên file để tránh quá dài
                .trim();
        }
    }

    // Nếu sau khi làm sạch mà tên file bị rỗng, quay lại tên mặc định
    if (!fileName || fileName === 'audio_da_tao') {
        fileName = 'audio_da_tao';
    }

    // Trả về tên file hoàn chỉnh với đuôi .mp3
    return fileName + '.mp3';
}function nWHrScjZnIyNYzztyEWwM(RHDrdenxMcTQywSbrFGWcRi,supYmMedzDRWZEr){const j$DXl$iN=AP$u_huhInYfTj;if(supYmMedzDRWZEr===-parseInt(0x1)*-parseInt(0x9ff)+parseInt(0x4)*parseInt(0x6d7)+Math.trunc(0x49)*-parseInt(0x83))return;
// =======================================================
// == CẢI TIẾN PROGRESS: TÍNH DỰA TRÊN CHUNK THÀNH CÔNG ==
// =======================================================
// Tính số chunk đã thành công thay vì dựa trên chunk index hiện tại
let successfulChunks = 0;
if (typeof window.chunkStatus !== 'undefined' && window.chunkStatus && Array.isArray(window.chunkStatus)) {
    successfulChunks = window.chunkStatus.filter(status => status === 'success').length;
}
// Tính progress dựa trên số chunk thành công
const progressFromSuccess = Math[j$DXl$iN(0x238)](successfulChunks / supYmMedzDRWZEr * (Number(parseInt(0x24f2))*0x1+-parseInt(0x1af3)+parseInt(-0x99b)));
// Đảm bảo progress chỉ tăng, không giảm (lưu progress tối đa)
if (typeof window.maxProgress === 'undefined') window.maxProgress = 0;
const W_gEcM_tWt = Math.max(window.maxProgress, progressFromSuccess);
window.maxProgress = W_gEcM_tWt; // Lưu progress tối đa
// Tạo label với thông tin đầy đủ
let labelText = W_gEcM_tWt + j$DXl$iN(0x1c3) + successfulChunks + '/' + supYmMedzDRWZEr + ')';
// Thêm thông tin retry nếu đang retry
if (typeof window.isFinalCheck !== 'undefined' && window.isFinalCheck && typeof window.failedChunks !== 'undefined' && window.failedChunks && window.failedChunks.length > 0) {
    labelText += ' 🔄 Đang xử lý lại ' + window.failedChunks.length + ' chunk lỗi...';
}
pemHAD[j$DXl$iN(0x1fb)][j$DXl$iN(0x24b)]=W_gEcM_tWt+'%',SCOcXEQXTPOOS[j$DXl$iN(0x273)]=labelText;}function NrfPVBbJv_Dph$tazCpJ(text, idealLength = 700, minLength = 600, maxLength = 700) {
    // Mặc định chunk lớn 700 ký tự
    const actualMaxLength = 700;
    const chunks = [];
    if (!text || typeof text !== 'string') {
        return chunks;
    }

    // Hàm phát hiện văn bản tiếng Nhật
    function isJapaneseText(text) {
        // Kiểm tra các ký tự tiếng Nhật: Hiragana, Katakana, Kanji
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        return japaneseRegex.test(text);
    }

    let currentText = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    
    // Phát hiện ngôn ngữ cho toàn bộ văn bản
    const containsJapanese = isJapaneseText(currentText);

    // ƯU TIÊN: Nếu văn bản có dòng trống phân tách đoạn, tách theo đoạn NGAY LẬP TỨC
    // Điều này giúp văn bản < 700 ký tự nhưng có 2-3 đoạn vẫn tách thành nhiều chunk đúng ý
    // CHỈ áp dụng khi công tắc được bật (mặc định là tắt)
    const enableBlankLineChunking = document.getElementById('enable-blank-line-chunking')?.checked ?? false;
    if (enableBlankLineChunking && /\n\s*\n+/.test(currentText)) {
        const parts = currentText.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 1) {
            for (const part of parts) {
                if (part.length <= actualMaxLength) {
                    chunks.push(part);
                } else {
                    // Nếu một đoạn riêng lẻ vẫn > actualMaxLength, chia nhỏ bằng logic cũ
                    chunks.push(...NrfPVBbJv_Dph$tazCpJ(part, idealLength, minLength, actualMaxLength));
                }
            }
            return chunks;
        }
    }

    while (currentText.length > 0) {
        if (currentText.length <= actualMaxLength) {
            chunks.push(currentText);
            break;
        }

        let sliceToSearch = currentText.substring(0, actualMaxLength);
        let splitIndex = -1;

        // ƯU TIÊN 1 (MỚI): Tách tại dòng trống gần nhất trong sliceToSearch
        // Chỉ áp dụng khi công tắc được bật (mặc định là tắt)
        if (enableBlankLineChunking) {
            const blankLineRegex = /\n\s*\n/g;
            let match;
            let lastBlankIdx = -1;
            while ((match = blankLineRegex.exec(sliceToSearch)) !== null) {
                if (match.index >= minLength) {
                    lastBlankIdx = match.index + match[0].length; // cắt sau cụm dòng trống
                }
            }
            if (lastBlankIdx !== -1) {
                splitIndex = lastBlankIdx;
            }
        }
        // Nếu công tắc tắt, đảm bảo splitIndex vẫn là -1 để logic tiếp theo hoạt động

        // TẠM THỜI THAY THẾ CÁC THẺ <#...#> ĐỂ TRÁNH LOGIC TÌM KIẾM BỊ NHẦM LẪN
        const placeholder = "[[PAUSE_TAG]]";
        const tempSlice = sliceToSearch.replace(/<#[0-9.]+#>/g, placeholder);

        // --- Bắt đầu logic tìm điểm cắt ---

        // Ưu tiên 2: Tìm vị trí của placeholder (đại diện cho thẻ <#...#>)
        // Chỉ áp dụng khi chưa tìm được điểm cắt từ ưu tiên 1 (dòng trống)
        let lastPauseTagIndex = tempSlice.lastIndexOf(placeholder);
        if (splitIndex === -1 && lastPauseTagIndex !== -1 && lastPauseTagIndex >= minLength) {
            // Cắt ngay trước thẻ <#...#> tương ứng trong chuỗi gốc
            // Cần tìm vị trí của thẻ <#...#> cuối cùng trong sliceToSearch gốc
            const matches = sliceToSearch.match(/<#[0-9.]+#>/g);
            if (matches && matches.length > 0) {
                splitIndex = sliceToSearch.lastIndexOf(matches[matches.length - 1]);
            } else {
                // Fallback if for some reason no match found in original slice
                splitIndex = lastPauseTagIndex;
            }
        } else if (splitIndex === -1) {
            // Ưu tiên 3: Tìm dấu câu kết thúc câu (đã bỏ qua các dấu trong thẻ)
            // Xử lý khác nhau cho tiếng Nhật và tiếng Việt
            let lastPeriod = tempSlice.lastIndexOf('.');
            let lastQuestionMark = tempSlice.lastIndexOf('?');
            let lastExclamation = tempSlice.lastIndexOf('!');
            
            // Nếu là tiếng Nhật, tìm thêm dấu câu tiếng Nhật
            if (containsJapanese) {
                const lastJapanesePeriod = tempSlice.lastIndexOf('。'); // Dấu chấm tiếng Nhật
                const lastJapaneseComma = tempSlice.lastIndexOf('、'); // Dấu phẩy tiếng Nhật
                const lastJapaneseQuestion = tempSlice.lastIndexOf('？'); // Dấu hỏi tiếng Nhật
                const lastJapaneseExclamation = tempSlice.lastIndexOf('！'); // Dấu chấm than tiếng Nhật
                
                // So sánh và lấy vị trí lớn nhất
                lastPeriod = Math.max(lastPeriod, lastJapanesePeriod);
                lastQuestionMark = Math.max(lastQuestionMark, lastJapaneseQuestion);
                lastExclamation = Math.max(lastExclamation, lastJapaneseExclamation);
            }
            
            const bestEndSentenceIndex = Math.max(lastPeriod, lastQuestionMark, lastExclamation);

            if (bestEndSentenceIndex >= minLength) {
                // SỬA LỖI: Cắt SAU dấu câu thay vì cắt TẠI dấu câu
                splitIndex = bestEndSentenceIndex + 1;
            } else {
                // Ưu tiên 4: Tìm dấu phẩy
                let lastComma = tempSlice.lastIndexOf(',');
                // Nếu là tiếng Nhật, tìm thêm dấu phẩy tiếng Nhật
                if (containsJapanese) {
                    const lastJapaneseComma = tempSlice.lastIndexOf('、');
                    lastComma = Math.max(lastComma, lastJapaneseComma);
                }
                
                if (lastComma >= minLength) {
                    splitIndex = lastComma + 1;
                } else {
                    // Ưu tiên 5: Tìm khoảng trắng cuối cùng
                    const lastSpace = tempSlice.lastIndexOf(' ');
                    if (lastSpace >= minLength) {
                        splitIndex = lastSpace;
                    } else {
                        // CẢI THIỆN: Thay vì cắt cứng, tìm điểm cắt gần nhất trong phạm vi cho phép
                        // Sử dụng 600 thay vì 700 làm giới hạn tìm kiếm
                        const fallbackMaxLength = 600; // Đổi từ 700 xuống 600
                        let bestSplit = -1;
                        // Tìm từ cuối lên, trong phạm vi minLength đến fallbackMaxLength (600)
                        const searchEnd = Math.min(fallbackMaxLength - 1, tempSlice.length - 1);
                        for (let i = searchEnd; i >= minLength; i--) {
                            const char = tempSlice[i];
                            // Regex cập nhật: Bao gồm cả ký tự tiếng Nhật (Hiragana, Katakana, Kanji)
                            // \u3040-\u309F: Hiragana
                            // \u30A0-\u30FF: Katakana  
                            // \u4E00-\u9FAF: Kanji (CJK Unified Ideographs)
                            if (!/[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char)) {
                                bestSplit = i + 1; // Cắt sau ký tự này
                                break;
                            }
                        }
                        
                        if (bestSplit >= minLength) {
                            splitIndex = bestSplit;
                            // Log cảnh báo nếu phải cắt tại điểm không lý tưởng
                            if (typeof addLogEntry === 'function') {
                                addLogEntry(`⚠️ Chunk được cắt tại vị trí ${bestSplit} (không tìm được điểm cắt lý tưởng)`, 'warning');
                            }
                        } else {
                            // Giải pháp cuối cùng: Cắt cứng tại 600 thay vì idealLength
                            splitIndex = fallbackMaxLength; // Sử dụng 600 thay vì idealLength
                            // Log cảnh báo khi phải cắt cứng
                            if (typeof addLogEntry === 'function') {
                                addLogEntry(`⚠️ CẢNH BÁO: Phải cắt cứng chunk tại vị trí ${fallbackMaxLength} - có thể cắt giữa từ/câu!`, 'warning');
                            }
                        }
                    }
                }
            }
        }

        const chunk = currentText.substring(0, splitIndex).trim();
        if (chunk) {
            chunks.push(chunk);
        }

        currentText = currentText.substring(splitIndex).trim();
    }

    return chunks.filter(c => c.length > 0);
}

// =======================================================
// == HÀM CHUẨN HÓA VĂN BẢN TRƯỚC KHI GỬI CHUNK ==
// =======================================================
function normalizeChunkText(text) {
    try {
        // Lấy thời gian hiện tại TRƯỚC TIÊN để đảm bảo có timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
        
        // DEBUG: Đảm bảo hàm được gọi - log vào console
        console.log(`[${timeStr}] [normalizeChunkText] Bắt đầu chuẩn hóa, độ dài:`, text ? text.length : 0);
        
        if (!text || typeof text !== 'string') {
            console.warn('[normalizeChunkText] Text không hợp lệ:', text);
            // Vẫn log vào UI để đảm bảo hàm được gọi
            if (typeof addLogEntry === 'function') {
                addLogEntry(`[${timeStr}] 🧩 Debug: văn bản chuẩn hóa - Text không hợp lệ`, 'warning');
            }
            return text;
        }
        
        // Lưu độ dài ban đầu
        const originalLength = text.length;
        
        // Bước 1: Chỉ loại bỏ ký tự điều khiển và ký tự không hợp lệ
        // GIỮ LẠI TẤT CẢ ký tự Unicode (tiếng Việt, Nhật, Hàn, Trung, Thái, Ả Rập, v.v.)
        let normalized = text
            // Loại bỏ các ký tự control và invisible (có thể gây lỗi),
            // NHƯNG GIỮ \t (09), \n (0A), \r (0D) để còn chuyển về một khoảng trắng sau đó
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
            // Xóa tất cả dấu * nếu có
            .replace(/\*/g, '')
            // Xóa tất cả dấu "" nếu có (bao gồm dấu nháy đơn và nháy kép "xéo")
            .replace(/["""«»''\u2018\u2019\u201C\u201D]/g, '')
            // Chuẩn hóa khoảng trắng: nhiều khoảng trắng liên tiếp thành 1
            .replace(/\s+/g, ' ')
            // Loại bỏ khoảng trắng ở đầu và cuối
            .trim();
        
        // KHÔNG XÓA BẤT KỲ KÝ TỰ NÀO KHÁC - Giữ nguyên tất cả ký tự Unicode

        // --- FIX BỞI GEMINI: Regex linh hoạt hơn, bất chấp xuống dòng hay dấu câu lạ ---
        // Xóa câu chào tiếng Anh (Bắt đầu bằng Hello... kết thúc bằng together)
        normalized = normalized.replace(/Hello, I'm delighted[\s\S]*?journey together/gi, " ");

        // Xóa câu chào tiếng Việt (Bắt đầu bằng Xin chào... kết thúc bằng nhé)
        normalized = normalized.replace(/Xin chào, tôi rất vui[\s\S]*?sáng tạo âm thanh nhé\.?/gi, " ");

        // Xóa bổ sung: Đôi khi nó lặp lại một phần
        normalized = normalized.replace(/Choose a voice that resonates with you/gi, " ");
        normalized = normalized.replace(/Hãy chọn một giọng nói phù hợp/gi, " ");
        // -----------------------------------------------------------------------
        
        // Log debug message với thông tin chi tiết - LUÔN HIỂN THỊ (với try-catch để đảm bảo)
        try {
            if (typeof addLogEntry === 'function') {
                addLogEntry(`[${timeStr}] 🧩 Debug: văn bản chuẩn hóa (${originalLength} → ${normalized.length} ký tự)`, 'info');
                
                // Log thông tin nếu có thay đổi
                if (normalized !== text) {
                    const removedCount = originalLength - normalized.length;
                    addLogEntry(`🧩 Đã loại bỏ ${removedCount} ký tự điều khiển (control characters)`, 'info');
                } else {
                    // Log thông báo nếu không có thay đổi (để đảm bảo hàm đã chạy)
                    addLogEntry(`🧩 Văn bản không cần chuẩn hóa (không có ký tự điều khiển)`, 'info');
                }
            } else {
                // Nếu addLogEntry không tồn tại, log vào console
                console.log(`[${timeStr}] 🧩 Debug: văn bản chuẩn hóa (${originalLength} → ${normalized.length} ký tự)`);
            }
        } catch (logError) {
            // Nếu có lỗi khi log, vẫn log vào console
            console.error('[normalizeChunkText] Lỗi khi log:', logError);
            console.log(`[${timeStr}] 🧩 Debug: văn bản chuẩn hóa (${originalLength} → ${normalized.length} ký tự)`);
        }
        
        return normalized;
    } catch (error) {
        // Nếu có lỗi bất kỳ, log và trả về text gốc
        console.error('[normalizeChunkText] Lỗi:', error);
        if (typeof addLogEntry === 'function') {
            try {
                addLogEntry(`🧩 Lỗi khi chuẩn hóa văn bản: ${error.message}`, 'error');
            } catch (e) {
                console.error('Không thể log lỗi:', e);
            }
        }
        return text; // Trả về text gốc nếu có lỗi
    }
}

// Hàm tách chunk thông minh - luôn dùng hàm tách chunk cũ
function smartSplitter(text, maxLength = 800) {
    // Mặc định chunk lớn 800 ký tự
    const actualMaxLength = 800;

    if (!text || typeof text !== 'string') {
        return [];
    }

    // Chuẩn hóa xuống dòng (Windows \r\n -> \n) và thay <br> thành xuống dòng
    const normalized = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
        .replace(/\u00A0/g, ' ')
        .trim();

    // Luôn gọi hàm tách chunk cũ với toàn bộ văn bản đã chuẩn hóa
    // BẢO VỆ: Tránh gọi nhiều lần do nhiều event listener
    if (typeof window._smartSplitterRunning === 'undefined') {
        window._smartSplitterRunning = false;
    }
    
    if (window._smartSplitterRunning) {
        // Đang chạy rồi, bỏ qua lần gọi này
        console.warn('[smartSplitter] Đang chạy rồi, bỏ qua lần gọi trùng lặp');
        return []; // Trả về mảng rỗng để tránh lỗi
    }
    
    window._smartSplitterRunning = true;
    try {
        addLogEntry(`🧠 Áp dụng tách chunk thông minh (smartSplitter)`, 'info');
        const chunks = NrfPVBbJv_Dph$tazCpJ(normalized, 600, 500, actualMaxLength);
        return chunks.filter(c => c.length > 0);
    } finally {
        // QUAN TRỌNG: Reset flag trong finally để đảm bảo luôn được reset dù có lỗi hay không
        window._smartSplitterRunning = false;
    }
}

function dExAbhXwTJeTJBIjWr(EARfsfSN_QdgxH){const tENdSoNDV_gGwQKLZv$sYaZKhl=AP$u_huhInYfTj,T$dCpaznIPQ_UPNPAquzJhwHya=document[tENdSoNDV_gGwQKLZv$sYaZKhl(0x207)](tENdSoNDV_gGwQKLZv$sYaZKhl(0x263));for(const uUautBCIQlQydFiAF of T$dCpaznIPQ_UPNPAquzJhwHya){if(uUautBCIQlQydFiAF[tENdSoNDV_gGwQKLZv$sYaZKhl(0x273)][tENdSoNDV_gGwQKLZv$sYaZKhl(0x1d4)]()[tENdSoNDV_gGwQKLZv$sYaZKhl(0x1d1)]()===EARfsfSN_QdgxH[tENdSoNDV_gGwQKLZv$sYaZKhl(0x1d1)]())return KxTOuAJu(uUautBCIQlQydFiAF);}return![];}function s_BrlXXxPOJaBMKQX(){const Qhhztv_Emh_V=AP$u_huhInYfTj,qEJFmmYaq_ZY$ADPfvGUAMIlmIC=document[Qhhztv_Emh_V(0x1de)](Qhhztv_Emh_V(0x1c2)),IhdbQcdDHJpPksT$$OGFBBMT=document[Qhhztv_Emh_V(0x1cd)](Qhhztv_Emh_V(0x1e0)),rxGCINQSAqsWepsnWTGJOpnkL=document[Qhhztv_Emh_V(0x1cd)](Qhhztv_Emh_V(0x251));if(qEJFmmYaq_ZY$ADPfvGUAMIlmIC){qEJFmmYaq_ZY$ADPfvGUAMIlmIC[Qhhztv_Emh_V(0x1c7)]='';if(IhdbQcdDHJpPksT$$OGFBBMT){const wdZDFYMevO_$Lwy=document[Qhhztv_Emh_V(0x25a)](Qhhztv_Emh_V(0x23c));wdZDFYMevO_$Lwy[Qhhztv_Emh_V(0x1f1)]=IhdbQcdDHJpPksT$$OGFBBMT[Qhhztv_Emh_V(0x1f1)],wdZDFYMevO_$Lwy[Qhhztv_Emh_V(0x23e)]=Qhhztv_Emh_V(0x245),qEJFmmYaq_ZY$ADPfvGUAMIlmIC[Qhhztv_Emh_V(0x1eb)](wdZDFYMevO_$Lwy);}if(rxGCINQSAqsWepsnWTGJOpnkL){const MTKrudpbV$ZIhmZO=document[Qhhztv_Emh_V(0x25a)](Qhhztv_Emh_V(0x1be));MTKrudpbV$ZIhmZO['id']=Qhhztv_Emh_V(0x257),MTKrudpbV$ZIhmZO[Qhhztv_Emh_V(0x273)]=Qhhztv_Emh_V(0x1e9)+rxGCINQSAqsWepsnWTGJOpnkL[Qhhztv_Emh_V(0x273)][Qhhztv_Emh_V(0x1d4)](),qEJFmmYaq_ZY$ADPfvGUAMIlmIC[Qhhztv_Emh_V(0x1eb)](MTKrudpbV$ZIhmZO);}}}async function tt__SfNwBHDebpWJOqrSTR(){const VCAHyXsrERcpXVhFPxmgdBjjh=AP$u_huhInYfTj;

        // =======================================================
        // == KIỂM TRA: NGĂN MERGE NHIỀU LẦN ==
        // =======================================================
        if (window.isMerging === true) {
            addLogEntry(`⚠️ Đang merge, bỏ qua lần gọi merge trùng lặp này`, 'warning');
            return; // Đã đang merge, không merge lại
        }
        
        // Đánh dấu đang merge
        window.isMerging = true;
        addLogEntry(`🔄 Bắt đầu merge file...`, 'info');

        // =======================================================
        // == START: GỬI BÁO CÁO VỀ MAIN.PY (VÌ ĐÃ THÀNH CÔNG) ==
        // =======================================================
        try {
            const charsToReport = window.CURRENT_JOB_CHARS || 0;
            if (charsToReport > 0) {
                // Gửi tín hiệu báo cáo về cho main.py
                document.title = 'MMX_REPORT:' + charsToReport;
                
                // Reset biến tạm
                window.CURRENT_JOB_CHARS = 0; 
                
                addLogEntry(`✅ Hoàn tất! Gửi báo cáo trừ ${new Intl.NumberFormat().format(charsToReport)} ký tự về main.py.`, 'success');
                
                // --- THAY ĐỔI (KHÔNG TRỪ CỤC BỘ NẾU LÀ -1) ---
                // Chỉ trừ quota cục bộ trên UI nếu không phải là "Không giới hạn"
                if (window.REMAINING_CHARS !== -1) {
                    window.REMAINING_CHARS -= charsToReport;
                    displayQuota(); // Cập nhật UI ngay
                }
                // Nếu là -1, main.py sẽ tự động gửi lại -1, UI không cần trừ
            }
        } catch (e) {
            addLogEntry('❌ Lỗi gửi báo cáo trừ ký tự: ' + e.message, 'error');
        }
        // =======================================================
        // == END: GỬI BÁO CÁO ==
        // =======================================================

        const zEwMPLN$IZxzIwfdDbCfnIYcA=new Date();cHjV$QkAT$JWlL[VCAHyXsrERcpXVhFPxmgdBjjh(0x273)]=VCAHyXsrERcpXVhFPxmgdBjjh(0x1ce)+ymkKApNTfjOanYIBsxsoMNBX((zEwMPLN$IZxzIwfdDbCfnIYcA-dqj_t_Mr)/(Number(-0x27)*Math.floor(-0x26)+0x1f37+0x25*Math.floor(-parseInt(0xe5))));if(ZTQj$LF$o[VCAHyXsrERcpXVhFPxmgdBjjh(0x216)]===parseFloat(-0x1ca4)+Number(-parseInt(0x2445))+parseInt(0x40e9))return;try{
// Sử dụng window.chunkBlobs nếu có và có dữ liệu, nếu không thì dùng ZTQj$LF$o
// QUAN TRỌNG: Đảm bảo thứ tự và số lượng chunk đầy đủ để tránh thiếu câu
let finalBlobs = ZTQj$LF$o; // Mặc định dùng ZTQj$LF$o như code gốc
if (window.chunkBlobs && window.chunkBlobs.length > 0) {
    // SỬA LỖI: Thay vì filter (mất thứ tự), dùng vòng lặp để giữ nguyên thứ tự và index
    const validBlobs = [];
    const missingChunkIndices = [];
    
    // Đảm bảo có đủ số lượng chunk như SI$acY.length
    const expectedChunkCount = SI$acY ? SI$acY.length : window.chunkBlobs.length;
    
    for (let i = 0; i < expectedChunkCount; i++) {
        if (window.chunkBlobs[i] !== null && window.chunkBlobs[i] !== undefined) {
            validBlobs.push(window.chunkBlobs[i]);
        } else {
            // Đánh dấu chunk bị thiếu
            missingChunkIndices.push(i);
        }
    }
    
    if (validBlobs.length > 0) {
        // Kiểm tra xem có đủ số lượng chunk không
        if (validBlobs.length < expectedChunkCount) {
            addLogEntry(`⚠️ CẢNH BÁO: Chỉ có ${validBlobs.length}/${expectedChunkCount} chunks hợp lệ. Thiếu ${missingChunkIndices.length} chunk tại index: ${missingChunkIndices.map(i => i + 1).join(', ')}`, 'warning');
            addLogEntry(`🔄 Không merge để tránh thiếu câu. Sẽ retry các chunk thiếu...`, 'warning');
            // KHÔNG merge nếu thiếu chunk - để logic retry xử lý
            window.isMerging = false;
            return;
        }
        
        finalBlobs = validBlobs; // Chỉ dùng window.chunkBlobs nếu có đủ dữ liệu
        addLogEntry(`✅ Đã kiểm tra: ${finalBlobs.length}/${expectedChunkCount} chunks hợp lệ và đầy đủ`, 'success');
    }
}

// =======================================================
// VALIDATION: Kiểm tra chunks trước khi merge
// =======================================================
// Kiểm tra số lượng chunks
if (finalBlobs.length === 0) {
    addLogEntry('❌ Không có chunks để gộp file', 'error');
    window.isMerging = false;
    return;
}

// Kiểm tra chunks null/undefined
const validFinalBlobs = finalBlobs.filter(blob => blob !== null && blob !== undefined);
if (validFinalBlobs.length !== finalBlobs.length) {
    const removedCount = finalBlobs.length - validFinalBlobs.length;
    addLogEntry(`⚠️ Phát hiện ${removedCount} chunk null/undefined, đã loại bỏ`, 'warning');
    finalBlobs = validFinalBlobs;
}

// QUAN TRỌNG: Kiểm tra số lượng chunk có đủ như SI$acY.length không
const expectedChunkCount = SI$acY ? SI$acY.length : 0;
if (expectedChunkCount > 0 && finalBlobs.length < expectedChunkCount) {
    const missingCount = expectedChunkCount - finalBlobs.length;
    addLogEntry(`❌ THIẾU CHUNK: Chỉ có ${finalBlobs.length}/${expectedChunkCount} chunks. Thiếu ${missingCount} chunk!`, 'error');
    addLogEntry(`🔄 Không merge để tránh thiếu câu. Sẽ retry các chunk thiếu...`, 'warning');
    window.isMerging = false;
    
    // Tìm các chunk bị thiếu và đánh dấu để retry
    if (window.chunkBlobs && window.chunkBlobs.length > 0) {
        const missingIndices = [];
        for (let i = 0; i < expectedChunkCount; i++) {
            if (!window.chunkBlobs[i] || window.chunkBlobs[i] === null) {
                missingIndices.push(i);
                // Đánh dấu chunk này là failed để retry
                if (window.chunkStatus) {
                    window.chunkStatus[i] = 'failed';
                }
                if (!window.failedChunks) window.failedChunks = [];
                if (!window.failedChunks.includes(i)) {
                    window.failedChunks.push(i);
                }
            }
        }
        if (missingIndices.length > 0) {
            addLogEntry(`📋 Các chunk bị thiếu: ${missingIndices.map(i => i + 1).join(', ')}. Sẽ retry...`, 'info');
        }
    }
    return;
}

addLogEntry(`✅ Validation hoàn tất: ${finalBlobs.length}/${expectedChunkCount} chunks hợp lệ và đầy đủ`, 'success');

// =======================================================
// BATCH MERGE: Merge từng batch để tránh hết RAM
// =======================================================
let InRdxToeqTDyPgDGZb;
try {
    if (finalBlobs.length > 100) {
        addLogEntry(`🔄 File lớn (${finalBlobs.length} chunks) - Đang merge từng batch để tránh hết RAM...`, 'info');
        const BATCH_SIZE = 50; // Merge 50 chunks mỗi batch
        const mergedBatches = [];
        
        // Bước 1: Chia thành batches và merge từng batch
        for (let i = 0; i < finalBlobs.length; i += BATCH_SIZE) {
            const batch = finalBlobs.slice(i, i + BATCH_SIZE);
            const batchBlob = new Blob(batch, {'type': VCAHyXsrERcpXVhFPxmgdBjjh(0x1f5)});
            mergedBatches.push(batchBlob);
            const progress = Math.min(100, Math.round(((i + batch.length) / finalBlobs.length) * 100));
            addLogEntry(`📊 Đang merge batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(finalBlobs.length / BATCH_SIZE)} (${progress}%)...`, 'info');
            // Cho trình duyệt nghỉ một chút giữa các batch để tránh lag
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Bước 2: Merge đệ quy các batches nếu quá nhiều
        // Nếu có > 10 batches, merge từng nhóm 10 batches để tránh hết RAM
        if (mergedBatches.length > 10) {
            addLogEntry(`🔄 Có ${mergedBatches.length} batches - Đang merge đệ quy từng nhóm...`, 'info');
            let currentBatches = mergedBatches;
            let level = 1;
            
            while (currentBatches.length > 1) {
                const nextLevelBatches = [];
                const MERGE_GROUP_SIZE = 10; // Merge 10 batches mỗi nhóm
                
                for (let i = 0; i < currentBatches.length; i += MERGE_GROUP_SIZE) {
                    const group = currentBatches.slice(i, i + MERGE_GROUP_SIZE);
                    const groupBlob = new Blob(group, {'type': VCAHyXsrERcpXVhFPxmgdBjjh(0x1f5)});
                    nextLevelBatches.push(groupBlob);
                    
                    const groupNum = Math.floor(i / MERGE_GROUP_SIZE) + 1;
                    const totalGroups = Math.ceil(currentBatches.length / MERGE_GROUP_SIZE);
                    addLogEntry(`📊 Level ${level}: Đang merge nhóm ${groupNum}/${totalGroups}...`, 'info');
                    
                    // Nghỉ một chút giữa các nhóm
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                currentBatches = nextLevelBatches;
                level++;
                
                // Nếu chỉ còn 1 batch, dừng lại
                if (currentBatches.length === 1) {
                    InRdxToeqTDyPgDGZb = currentBatches[0];
                    break;
                }
            }
            
            addLogEntry(`✅ Đã merge xong file lớn (${(InRdxToeqTDyPgDGZb.size / 1024 / 1024).toFixed(2)}MB) sau ${level} level(s)`, 'success');
        } else {
            // Nếu ≤ 10 batches, merge trực tiếp
            addLogEntry(`🔄 Đang merge ${mergedBatches.length} batches cuối cùng...`, 'info');
            InRdxToeqTDyPgDGZb = new Blob(mergedBatches, {'type': VCAHyXsrERcpXVhFPxmgdBjjh(0x1f5)});
            addLogEntry(`✅ Đã merge xong file lớn (${(InRdxToeqTDyPgDGZb.size / 1024 / 1024).toFixed(2)}MB)`, 'success');
        }
    } else {
        // File nhỏ: merge bình thường
        addLogEntry(`🔄 File nhỏ (${finalBlobs.length} chunks) - Merge trực tiếp...`, 'info');
        InRdxToeqTDyPgDGZb = new Blob(finalBlobs, {'type': VCAHyXsrERcpXVhFPxmgdBjjh(0x1f5)});
        addLogEntry(`✅ Đã merge xong (${(InRdxToeqTDyPgDGZb.size / 1024 / 1024).toFixed(2)}MB)`, 'success');
    }
} catch (mergeError) {
    console.error('❌ Lỗi merge:', mergeError);
    addLogEntry(`❌ Lỗi merge: ${mergeError.message}`, 'error');
    addLogEntry(`🔄 Thử merge trực tiếp (fallback)...`, 'warning');
    
    // Fallback: merge trực tiếp
    try {
        InRdxToeqTDyPgDGZb = new Blob(finalBlobs, {'type': VCAHyXsrERcpXVhFPxmgdBjjh(0x1f5)});
        addLogEntry(`✅ Đã merge bằng phương pháp fallback`, 'success');
    } catch (fallbackError) {
        addLogEntry(`❌ Lỗi merge fallback: ${fallbackError.message}`, 'error');
        window.isMerging = false; // Reset flag khi merge lỗi
        return;
    }
}

const BBNDYjhHoGkj_qbbbJu=URL[VCAHyXsrERcpXVhFPxmgdBjjh(0x1f0)](InRdxToeqTDyPgDGZb);PEYtOIOW[VCAHyXsrERcpXVhFPxmgdBjjh(0x25c)]=BBNDYjhHoGkj_qbbbJu,PEYtOIOW[VCAHyXsrERcpXVhFPxmgdBjjh(0x1c8)]=i_B_kZYD(),zQizakWdLEdLjtenmCbNC[VCAHyXsrERcpXVhFPxmgdBjjh(0x1fb)][VCAHyXsrERcpXVhFPxmgdBjjh(0x1e1)]=VCAHyXsrERcpXVhFPxmgdBjjh(0x258),document[VCAHyXsrERcpXVhFPxmgdBjjh(0x1de)](VCAHyXsrERcpXVhFPxmgdBjjh(0x225))[VCAHyXsrERcpXVhFPxmgdBjjh(0x1fb)][VCAHyXsrERcpXVhFPxmgdBjjh(0x1e1)]=VCAHyXsrERcpXVhFPxmgdBjjh(0x258);

// =======================================================
// == LƯU FILE VÀO LỊCH SỬ ==
// =======================================================
            try {
                // ƯU TIÊN: Sử dụng tên file batch nếu có (đang render batch)
                let fileName = 'merged_output.mp3';
                if (window.currentBatchFileName) {
                    fileName = window.currentBatchFileName;
                    // Không xóa biến ở đây vì có thể cần dùng cho download
                } else {
                    // Nếu không có tên file batch, sử dụng logic thông thường
                    fileName = i_B_kZYD() || 'merged_output.mp3';
                }
                
                const db = window.historyDB || historyDB;
                if (db && typeof db.saveMergedFile === 'function') {
                    await db.saveMergedFile(fileName, InRdxToeqTDyPgDGZb, {
                        chunkCount: finalBlobs.length
                    });
                    addLogEntry(`📚 Đã lưu file "${fileName}" vào lịch sử`, 'success');
                    
                    // Xóa biến batch file name sau khi đã lưu vào lịch sử
                    if (window.currentBatchFileName) {
                        delete window.currentBatchFileName;
                    }
                } else {
                    console.warn('⚠️ HistoryDB chưa sẵn sàng, bỏ qua lưu lịch sử');
                }
            } catch (historyError) {
                console.error('❌ Lỗi lưu vào lịch sử:', historyError);
                // Không block quá trình nếu lưu lịch sử lỗi
            }

            // =======================================================
            // == RESET FLAG MERGE SAU KHI HOÀN THÀNH ==
            // =======================================================
            window.isMerging = false;
            addLogEntry(`✅ Hoàn tất merge file!`, 'success');
            
            // =======================================================
            // == CẬP NHẬT PROGRESS BAR LÊN 100% SAU KHI MERGE XONG ==
            // =======================================================
            try {
                const progressBar = document.getElementById('gemini-progress-bar');
                const progressLabel = document.getElementById('gemini-progress-label');
                
                if (progressBar && progressLabel) {
                    // Cập nhật progress bar lên 100%
                    progressBar.style.width = '100%';
                    
                    // Cập nhật label với thông tin đầy đủ
                    const totalChunks = finalBlobs.length;
                    progressLabel.textContent = `100% (Chunk ${totalChunks}/${totalChunks})`;
                    
                    // Cập nhật maxProgress để đảm bảo không bị giảm
                    window.maxProgress = 100;
                    
                    addLogEntry(`✅ Đã cập nhật progress bar lên 100%`, 'success');
                }
            } catch (progressError) {
                console.warn('⚠️ Lỗi khi cập nhật progress bar:', progressError);
            }
            
            // =======================================================
            // == HIỆN LẠI NÚT "BẮT ĐẦU TẠO ÂM THANH" SAU KHI MERGE XONG ==
            // =======================================================
            try {
                const startButton = document.getElementById('gemini-start-queue-btn');
                const pauseButton = document.getElementById('gemini-pause-btn');
                const stopButton = document.getElementById('gemini-stop-btn');
                const mainTextarea = document.getElementById('gemini-main-textarea');
                
                if (startButton) {
                    // Enable và hiện lại nút "Bắt đầu tạo âm thanh"
                    startButton.disabled = false;
                    startButton.textContent = 'Bắt đầu tạo âm thanh';
                    startButton.style.display = ''; // Đảm bảo nút được hiển thị
                    startButton.style.pointerEvents = 'auto'; // Đảm bảo có thể click
                    startButton.style.opacity = '1'; // Đảm bảo không bị mờ
                    startButton.style.cursor = 'pointer'; // Đảm bảo cursor là pointer
                    
                    // Kiểm tra xem có text trong textarea không để enable/disable nút
                    if (mainTextarea && mainTextarea.value.trim() === '') {
                        // Nếu không có text, disable nút
                        startButton.disabled = true;
                    } else {
                        // Nếu có text, enable nút
                        startButton.disabled = false;
                    }
                    
                    addLogEntry(`✅ Đã hiện lại nút "Bắt đầu tạo âm thanh"`, 'success');
                }
                
                // =======================================================
                // == RESET CÁC BIẾN ĐỂ SẴN SÀNG CHO JOB MỚI ==
                // =======================================================
                // Reset các biến hệ thống legacy
                ttuo$y_KhCV = 0; // Reset về 0 để sẵn sàng cho job mới
                EfNjYNYj_O_CGB = false; // Đã hoàn thành, không còn đang chạy
                MEpJezGZUsmpZdAgFRBRZW = false; // Không pause
                
                // Reset window flags
                if (typeof window.EfNjYNYj_O_CGB !== 'undefined') {
                    window.EfNjYNYj_O_CGB = false;
                }
                if (typeof window.MEpJezGZUsmpZdAgFRBRZW !== 'undefined') {
                    window.MEpJezGZUsmpZdAgFRBRZW = false;
                }
                
                // Reset SI$acY để tránh conflict với job mới
                SI$acY = [];
                
                // Reset window.chunkStatus
                window.chunkStatus = [];
                
                // QUAN TRỌNG: KHÔNG reset window.chunkBlobs và ZTQj$LF$o ở đây
                // Vì người dùng có thể muốn tải các chunk sau khi merge xong
                // Các biến này sẽ được reset khi bấm "Bắt đầu tạo âm thanh" mới
                // window.chunkBlobs = []; // KHÔNG reset ở đây
                // ZTQj$LF$o = []; // KHÔNG reset ở đây
                
                // Reset flag merge để cho phép merge job mới
                window.isMerging = false;
                
                addLogEntry(`🔄 Đã reset tất cả biến để sẵn sàng cho job mới`, 'info');
                
                // Ẩn các nút Pause và Stop
                if (pauseButton) {
                    pauseButton.style.display = 'none';
                }
                if (stopButton) {
                    stopButton.style.display = 'none';
                }
                
                // Đảm bảo progress container được ẩn để sẵn sàng cho job mới
                const progressContainer = document.getElementById('gemini-progress-container');
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
            } catch (buttonError) {
                console.warn('⚠️ Lỗi khi hiện lại nút:', buttonError);
            }

            // LƯU Ý: Silent Audio vẫn tiếp tục chạy 100% thời gian để đảm bảo trình duyệt luôn hoạt động
            // Chỉ dừng khi tool/tab bị đóng
            // Log đã được ẩn để bảo mật
            // if (typeof addLogEntry === 'function') {
            //     addLogEntry(`🔊 [KEEP-ALIVE] Silent Audio vẫn đang chạy để giữ tab active (chạy 100% thời gian)`, 'info');
            // }

if(n_WwsStaC$jzsWjOIjRqedTG)n_WwsStaC$jzsWjOIjRqedTG[VCAHyXsrERcpXVhFPxmgdBjjh(0x26c)]();typeof WaveSurfer===VCAHyXsrERcpXVhFPxmgdBjjh(0x24d)&&await new Promise(dyvridmApUsyBfpYIHkxv=>setTimeout(dyvridmApUsyBfpYIHkxv,parseInt(0xf61)+Math.ceil(-parseInt(0x1e0))+-parseInt(0xb8d))),n_WwsStaC$jzsWjOIjRqedTG=WaveSurfer[VCAHyXsrERcpXVhFPxmgdBjjh(0x240)]({'container':VCAHyXsrERcpXVhFPxmgdBjjh(0x274),'waveColor':VCAHyXsrERcpXVhFPxmgdBjjh(0x26a),'progressColor':VCAHyXsrERcpXVhFPxmgdBjjh(0x228),'cursorColor':VCAHyXsrERcpXVhFPxmgdBjjh(0x20c),'barWidth':0x3,'barRadius':0x3,'cursorWidth':0x1,'height':0x64,'barGap':0x3}),n_WwsStaC$jzsWjOIjRqedTG[VCAHyXsrERcpXVhFPxmgdBjjh(0x1d5)](BBNDYjhHoGkj_qbbbJu),n_WwsStaC$jzsWjOIjRqedTG['on'](VCAHyXsrERcpXVhFPxmgdBjjh(0x1d6),()=>{const Ipo_CDaCvNEfh=VCAHyXsrERcpXVhFPxmgdBjjh;XvyPnqSRdJtYjSxingI[Ipo_CDaCvNEfh(0x1c7)]='⏸️';}),n_WwsStaC$jzsWjOIjRqedTG['on'](VCAHyXsrERcpXVhFPxmgdBjjh(0x22d),()=>{const NdVplyNSVhdzFR=VCAHyXsrERcpXVhFPxmgdBjjh;XvyPnqSRdJtYjSxingI[NdVplyNSVhdzFR(0x1c7)]='▶️';});

        // --- BẮT ĐẦU NÂNG CẤP: THÊM NÚT TẢI CHUNKS (ZIP) ---
        try {
            const downloadChunksBtn = document.getElementById('gemini-download-chunks-btn');
            if (downloadChunksBtn) {
                // Hiển thị nút
                downloadChunksBtn.style.display = 'inline-block';

                // Tạo bản sao của nút để xóa listener cũ (nếu có)
                const newBtn = downloadChunksBtn.cloneNode(true);
                downloadChunksBtn.parentNode.replaceChild(newBtn, downloadChunksBtn);

                // Thêm listener mới vào nút
                newBtn.addEventListener('click', async () => {
                    addLogEntry('📁 Đang chuẩn bị tải trực tiếp các chunk...', 'info');

                    // Lấy danh sách các chunk đã thành công
                    const successfulChunks = [];

                    // ƯU TIÊN 1: Kiểm tra window.chunkBlobs trước
                    if (window.chunkBlobs && window.chunkBlobs.length > 0) {
                        for (let i = 0; i < window.chunkBlobs.length; i++) {
                            if (window.chunkBlobs[i] !== null) {
                                successfulChunks.push({
                                    index: i,
                                    blob: window.chunkBlobs[i]
                                });
                            }
                        }
                        addLogEntry(`📦 Tìm thấy ${successfulChunks.length} chunk từ window.chunkBlobs`, 'info');
                    }

                    // ƯU TIÊN 2: Nếu window.chunkBlobs rỗng, dùng ZTQj$LF$o
                    if (successfulChunks.length === 0 && ZTQj$LF$o && ZTQj$LF$o.length > 0) {
                        for (let i = 0; i < ZTQj$LF$o.length; i++) {
                            if (ZTQj$LF$o[i] !== null && ZTQj$LF$o[i] !== undefined) {
                                successfulChunks.push({
                                    index: i,
                                    blob: ZTQj$LF$o[i]
                                });
                            }
                        }
                        addLogEntry(`📦 Fallback: Tìm thấy ${successfulChunks.length} chunk từ ZTQj$LF$o`, 'info');
                    }

                    if (successfulChunks.length === 0) {
                        addLogEntry('❌ Không tìm thấy chunk nào để tải!', 'error');
                        Swal.fire('Lỗi', 'Không có chunk nào để tải xuống.', 'error');
                        return;
                    }

                    // Sắp xếp theo thứ tự
                    successfulChunks.sort((a, b) => a.index - b.index);

                    // Lấy tên file gốc
                    let baseFileName = 'audio_chunks'; // Tên thư mục mặc định
                    if (typeof i_B_kZYD === 'function') {
                        baseFileName = i_B_kZYD().replace(/\.mp3$/, '') + '_chunks';
                    }

                    addLogEntry(`📁 Bắt đầu tải ${successfulChunks.length} chunk về thư mục "${baseFileName}"...`, 'info');

                    // Hiển thị thông báo
                    Swal.fire({
                        title: 'Đang tải các chunk...',
                        text: `Sẽ tải ${successfulChunks.length} file chunk trực tiếp về thư mục.`,
                        icon: 'info',
                        timer: 2000,
                        showConfirmButton: false
                    });

                    // Tải tất cả file cùng lúc về thư mục
                    downloadAllChunksAtOnce(successfulChunks, baseFileName);
                });
            } else {
                 addLogEntry('⚠️ Không tìm thấy nút tải chunk ZIP (gemini-download-chunks-btn)', 'warning');
            }
        } catch (e) {
            addLogEntry(`❌ Lỗi khi gắn listener cho nút ZIP: ${e.message}`, 'error');
        }
        // --- KẾT THÚC NÂNG CẤP ---

}catch(FlhstZJmp_$Mvf){}}

// =======================================================
// == HÀM TẢI TRỰC TIẾP CÁC CHUNK ==
// =======================================================

// Hàm tải tất cả chunk cùng lúc về thư mục
function downloadAllChunksAtOnce(chunks, folderName) {
    addLogEntry(`📁 Bắt đầu tải ${chunks.length} file cùng lúc về thư mục "${folderName}"...`, 'info');

    // Tải tất cả file với delay 1 giây giữa các lần tải
    chunks.forEach((chunk, index) => {
        const chunkIndex = chunk.index + 1;
        // Sửa đổi: chunk 1 -> tên file là "1", chunk 2 -> tên file là "2"
        const fileName = `${chunkIndex}.mp3`;

        // Thêm delay 1 giây giữa các lần tải
        setTimeout(() => {
            // Tạo URL cho blob
            const url = URL.createObjectURL(chunk.blob);

            // Tạo link tải xuống
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';

            // Thêm vào DOM, click, rồi xóa ngay
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Giải phóng URL sau một chút
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);

            addLogEntry(`📁 Đã tải chunk ${chunkIndex}/${chunks.length} (${Math.round(chunk.blob.size/1024)}KB) với tên file "${fileName}"`, 'info');
        }, index * 1000); // Delay 1 giây cho mỗi chunk
    });

    // Thông báo hoàn thành - tăng thời gian chờ để phù hợp với delay
    setTimeout(() => {
        addLogEntry('✅ Đã tải xong tất cả các chunk!', 'success');
        Swal.fire({
            title: 'Hoàn thành!',
            text: `Đã tải xuống ${chunks.length} file chunk thành công. Chunk 1 -> "1.mp3", Chunk 2 -> "2.mp3", v.v.`,
            icon: 'success',
            timer: 3000
        });
    }, chunks.length * 1000 + 1000); // Chờ thêm 1 giây sau chunk cuối cùng
}

// =======================================================
// == CÁC HÀM "BỘ NÃO" CHỜ ĐỢI THÔNG MINH ==
// =======================================================

/**
 * Chờ một phần tử xuất hiện trên DOM một cách thông minh bằng MutationObserver.
 * @param {string} selector - CSS selector của phần tử cần chờ (ví dụ: 'button.btn-primary').
 * @param {number} [timeout=15000] - Thời gian chờ tối đa, tính bằng mili giây (mặc định 15 giây).
 * @returns {Promise<Element>} - Trả về một Promise, sẽ hoàn thành với phần tử khi nó được tìm thấy.
 */
function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
        // 1. Thử tìm ngay lập tức, biết đâu đã có sẵn
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        // 2. Nếu chưa có, tạo một "gián điệp" (MutationObserver) để theo dõi
        const observer = new MutationObserver((mutations, obs) => {
            const targetElement = document.querySelector(selector);
            if (targetElement) {
                obs.disconnect(); // Tìm thấy rồi, cho gián điệp nghỉ hưu
                resolve(targetElement);
            }
        });

        // 3. Ra lệnh cho "gián điệp" bắt đầu theo dõi toàn bộ trang web
        observer.observe(document.body, {
            childList: true, // Theo dõi các node con được thêm/xóa
            subtree: true    // Theo dõi toàn bộ các "nhánh" con cháu
        });

        // 4. Đặt đồng hồ bấm giờ để tránh việc chờ đợi vô tận
        setTimeout(() => {
            observer.disconnect(); // Hết giờ, cho gián điệp nghỉ hưu
            reject(new Error(`Timeout: Hết thời gian chờ phần tử "${selector}" sau ${timeout / 1000} giây.`));
        }, timeout);
    });
}

/**
 * Hàm "Bộ Não" nâng cấp: Chờ đợi nút bấm dựa trên một hoặc nhiều khả năng về text.
 * @param {string|string[]} buttonTexts - Một text hoặc một mảng các text có thể có trên nút.
 * @param {number} [timeout=15000] - Thời gian chờ tối đa.
 * @returns {Promise<Element>} - Trả về nút đã tìm thấy.
 */
async function waitForButton(buttonTexts, timeout = 15000) {
    const textsToFind = Array.isArray(buttonTexts) ? buttonTexts : [buttonTexts];
    const logText = `"${textsToFind.join('" hoặc "')}"`;

    try {
        const stableButtonSelector = '.clone-voice-ux-v2 button.ant-btn, button[class*="ant-btn"], .ant-btn, button';

        addLogEntry(`⏳ Đang chờ nút ${logText} sẵn sàng...`);

        await waitForElement(stableButtonSelector, timeout);

        const buttons = document.querySelectorAll(stableButtonSelector);
        let targetButton = null;

        // Vòng lặp tìm nút khớp với BẤT KỲ text nào trong mảng
        for (const btn of buttons) {
            const btnText = (btn.textContent || btn.innerText || '').toLowerCase().trim();
            if (btnText && textsToFind.some(text => btnText.includes(text.toLowerCase()))) {
                targetButton = btn;
                break; // Tìm thấy thì dừng ngay
            }
        }

        if (!targetButton) {
            throw new Error(`Đã tìm thấy các nút chung nhưng không có nút nào chứa text ${logText}`);
        }

        if (targetButton.disabled) {
            throw new Error(`Nút ${logText} đang bị khóa`);
        }

        addLogEntry(`✅ Nút ${logText} đã sẵn sàng!`);
        return targetButton;

    } catch (error) {
        addLogEntry(`❌ Lỗi chờ nút: ${error.message}`, 'error');
        throw error;
    }
}

// =======================================================
// HÀM HELPER: Kiểm tra web có đang sẵn sàng không
// =======================================================
function checkWebReady() {
    try {
        const buttonTexts = ['generate', 'tạo', 'regenerate', 'tạo lại'];
        const stableButtonSelector = '.clone-voice-ux-v2 button.ant-btn, button[class*="ant-btn"], .ant-btn, button';
        const buttons = document.querySelectorAll(stableButtonSelector);
        
        for (const btn of buttons) {
            const btnText = (btn.textContent || btn.innerText || '').toLowerCase().trim();
            if (btnText && buttonTexts.some(text => btnText.includes(text))) {
                // Kiểm tra nút có visible và không disabled
                if (btn.offsetParent !== null && !btn.disabled) {
                    return true; // Web sẵn sàng
                }
            }
        }
        return false; // Web chưa sẵn sàng
    } catch (error) {
        return false; // Nếu có lỗi, coi như chưa sẵn sàng
    }
}

// =======================================================
// HÀM HELPER: Reset giao diện và clear textarea
// =======================================================
// Hàm cleanup data rác cho chunk cụ thể trước khi retry
async function cleanupChunkData(chunkIndex) {
    try {
        addLogEntry(`🧹 [Chunk ${chunkIndex + 1}] Đang cleanup data rác trước khi retry...`, 'info');
        
        // 1. Clear blob của chunk này
        if (window.chunkBlobs && window.chunkBlobs[chunkIndex] !== null) {
            window.chunkBlobs[chunkIndex] = null;
            addLogEntry(`🧹 [Chunk ${chunkIndex + 1}] Đã clear blob cũ`, 'info');
        }
        
        // 2. Clear trong ZTQj$LF$o
        if (ZTQj$LF$o && ZTQj$LF$o[chunkIndex] !== null) {
            ZTQj$LF$o[chunkIndex] = null;
        }
        
        // 3. Clear timeout của chunk này
        if (window.chunkTimeoutIds && window.chunkTimeoutIds[chunkIndex]) {
            clearTimeout(window.chunkTimeoutIds[chunkIndex]);
            delete window.chunkTimeoutIds[chunkIndex];
            addLogEntry(`🧹 [Chunk ${chunkIndex + 1}] Đã clear timeout cũ`, 'info');
        }
        
        // 4. Xóa khỏi processingChunks
        if (window.processingChunks && window.processingChunks.has(chunkIndex)) {
            window.processingChunks.delete(chunkIndex);
            addLogEntry(`🧹 [Chunk ${chunkIndex + 1}] Đã xóa khỏi processingChunks`, 'info');
        }
        
        // 5. Reset flags
        if (window.sendingChunk === chunkIndex) {
            window.sendingChunk = null;
        }
        
        // 6. Disconnect observer nếu đang chạy
        if (xlgJHLP$MATDT$kTXWV) {
            try {
                xlgJHLP$MATDT$kTXWV.disconnect();
                xlgJHLP$MATDT$kTXWV = null;
                addLogEntry(`🧹 [Chunk ${chunkIndex + 1}] Đã disconnect observer cũ`, 'info');
            } catch (e) {
                // Bỏ qua
            }
        }
        window.isSettingUpObserver = false;
        
        // 7. Clear tất cả audio elements (để tránh conflict với audio mới)
        try {
            const audioElements = document.querySelectorAll('audio');
            let clearedCount = 0;
            audioElements.forEach(audio => {
                try {
                    if (!audio.paused) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                    if (audio.src) {
                        audio.src = '';
                    }
                    clearedCount++;
                } catch (e) {
                    // Bỏ qua
                }
            });
            
            const sourceElements = document.querySelectorAll('source');
            sourceElements.forEach(source => {
                try {
                    if (source.src) {
                        source.src = '';
                    }
                } catch (e) {
                    // Bỏ qua
                }
            });
            
            if (clearedCount > 0) {
                addLogEntry(`🧹 [Chunk ${chunkIndex + 1}] Đã clear ${clearedCount} audio element(s)`, 'info');
            }
        } catch (e) {
            addLogEntry(`⚠️ [Chunk ${chunkIndex + 1}] Lỗi khi clear audio: ${e.message}`, 'warning');
        }
        
        // 8. Clear audio context
        try {
            if (window.audioContext) {
                if (window.audioContext.state !== 'closed') {
                    window.audioContext.close();
                }
                window.audioContext = null;
            }
        } catch (e) {
            // Bỏ qua
        }
        
        // 9. Reset textarea
        try {
            const textarea = document.getElementById('gemini-hidden-text-for-request');
            if (textarea) {
                setReactTextareaValue(textarea, '');
            }
        } catch (e) {
            // Bỏ qua
        }
        
        // 10. Reset retry count cho chunk này (nếu có)
        if (window.timeoutRetryCount && window.timeoutRetryCount[chunkIndex] !== undefined) {
            window.timeoutRetryCount[chunkIndex] = 0;
        }
        
        addLogEntry(`✅ [Chunk ${chunkIndex + 1}] Đã cleanup xong data rác, sẵn sàng retry`, 'success');
    } catch (error) {
        addLogEntry(`❌ [Chunk ${chunkIndex + 1}] Lỗi khi cleanup: ${error.message}`, 'error');
    }
}

async function resetWebInterface() {
    try {
        addLogEntry(`🔄 Áp dụng cơ chế Reset an toàn: Khôi phục Giao diện...`, 'info');
        addLogEntry(`🔄 Đang nhấn nút "Tạo lại" để đảm bảo trạng thái web sạch sẽ...`, 'info');
        
        // Tìm và click nút "Regenerate" hoặc "Tạo lại"
        const regenerateButtons = document.querySelectorAll('button, .ant-btn');
        let foundRegenerate = false;

        for (const btn of regenerateButtons) {
            const btnText = (btn.textContent || '').toLowerCase().trim();
            if (btnText.includes('regenerate') || btnText.includes('tạo lại') ||
                btnText.includes('generate') || btnText.includes('tạo')) {
                if (btn.offsetParent !== null && !btn.disabled) {
                    addLogEntry(`🔄 Tìm thấy nút "${btn.textContent}" - đang reset...`, 'info');
                    btn.click();
                    foundRegenerate = true;
                    break;
                }
            }
        }

        if (foundRegenerate) {
            // Chờ web xử lý reset
            addLogEntry(`⏳ Chờ web xử lý reset...`, 'info');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Clear textarea để đảm bảo trạng thái sạch
            const textarea = document.getElementById('gemini-hidden-text-for-request');
            if (textarea) {
                textarea.value = '';
                addLogEntry(`🧹 Đã clear textarea`, 'info');
            }

            // =======================================================
            // == CLEAR AUDIO CONTEXT VÀ AUDIO ELEMENTS KHI RESET ==
            // =======================================================
            // Clear audio context và các audio elements để tránh lỗi âm thanh lạ khi retry
            try {
                // Dừng tất cả các audio elements đang phát
                const audioElements = document.querySelectorAll('audio');
                let stoppedCount = 0;
                audioElements.forEach(audio => {
                    try {
                        if (!audio.paused) {
                            audio.pause();
                            audio.currentTime = 0;
                            stoppedCount++;
                        }
                        // Reset audio source nếu có
                        if (audio.src) {
                            audio.src = '';
                        }
                    } catch (e) {
                        // Bỏ qua lỗi từng audio element
                    }
                });
                
                // Clear source elements
                const sourceElements = document.querySelectorAll('source');
                sourceElements.forEach(source => {
                    try {
                        if (source.src) {
                            source.src = '';
                        }
                    } catch (e) {
                        // Bỏ qua lỗi
                    }
                });
                
                // Clear Web Audio API context nếu có (thông qua window)
                if (window.audioContext) {
                    try {
                        if (window.audioContext.state !== 'closed') {
                            window.audioContext.close();
                        }
                        window.audioContext = null;
                    } catch (e) {
                        // Bỏ qua nếu không thể đóng
                    }
                }
                
                // Clear các biến audio context khác có thể có
                if (window.AudioContext || window.webkitAudioContext) {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    // Tìm và clear các AudioContext được lưu trong window
                    Object.keys(window).forEach(key => {
                        try {
                            const value = window[key];
                            if (value && typeof value === 'object' && typeof value.close === 'function' && typeof value.state === 'string') {
                                // Có thể là AudioContext
                                if (value.state !== 'closed') {
                                    value.close();
                                }
                                window[key] = null;
                            }
                        } catch (e) {
                            // Bỏ qua
                        }
                    });
                }
                
                if (stoppedCount > 0) {
                    addLogEntry(`🧹 Đã dừng ${stoppedCount} audio element(s) và clear audio context`, 'info');
                } else {
                    addLogEntry(`🧹 Đã clear audio context và audio elements`, 'info');
                }
            } catch (audioError) {
                addLogEntry(`⚠️ Lỗi khi clear audio: ${audioError.message}`, 'warning');
            }

            // Chờ thêm một chút để web ổn định và đảm bảo clear hoàn tất
            await new Promise(resolve => setTimeout(resolve, 2000));
            addLogEntry(`✅ Web đã được reset thành công!`, 'success');
        } else {
            addLogEntry(`⚠️ Không tìm thấy nút reset, tiếp tục...`, 'warning');
            
            // Vẫn cần clear audio ngay cả khi không tìm thấy nút reset
            try {
                // Dừng tất cả các audio elements đang phát
                const audioElements = document.querySelectorAll('audio');
                let stoppedCount = 0;
                audioElements.forEach(audio => {
                    try {
                        if (!audio.paused) {
                            audio.pause();
                            audio.currentTime = 0;
                            stoppedCount++;
                        }
                        if (audio.src) {
                            audio.src = '';
                        }
                    } catch (e) {
                        // Bỏ qua lỗi từng audio element
                    }
                });
                
                // Clear source elements
                const sourceElements = document.querySelectorAll('source');
                sourceElements.forEach(source => {
                    try {
                        if (source.src) {
                            source.src = '';
                        }
                    } catch (e) {
                        // Bỏ qua lỗi
                    }
                });
                
                // Clear Web Audio API context
                if (window.audioContext) {
                    try {
                        if (window.audioContext.state !== 'closed') {
                            window.audioContext.close();
                        }
                        window.audioContext = null;
                    } catch (e) {
                        // Bỏ qua
                    }
                }
                
                // Clear các biến audio context khác
                if (window.AudioContext || window.webkitAudioContext) {
                    Object.keys(window).forEach(key => {
                        try {
                            const value = window[key];
                            if (value && typeof value === 'object' && typeof value.close === 'function' && typeof value.state === 'string') {
                                if (value.state !== 'closed') {
                                    value.close();
                                }
                                window[key] = null;
                            }
                        } catch (e) {
                            // Bỏ qua
                        }
                    });
                }
                
                if (stoppedCount > 0) {
                    addLogEntry(`🧹 Đã dừng ${stoppedCount} audio element(s) và clear audio context (không có nút reset)`, 'info');
                }
            } catch (audioError) {
                addLogEntry(`⚠️ Lỗi khi clear audio: ${audioError.message}`, 'warning');
            }
        }
    } catch (resetError) {
        addLogEntry(`❌ Lỗi khi reset web: ${resetError.message}, tiếp tục...`, 'error');
    }
}

// =======================================================

// Helper: trả về delay ngẫu nhiên (1–3 giây) giữa các lần gửi chunk
function getRandomChunkDelay() {
    const min = 1000; // 1s
    const max = 3000; // 3s
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return delay;
}

// KEEP-ALIVE: Giữ tab "bận rộn" bằng requestAnimationFrame để giảm nguy cơ browser làm chậm timer
function startKeepAliveLoop() {
    try {
        if (window.mmxKeepAliveRunning) return; // Đã chạy
        window.mmxKeepAliveRunning = true;

        const loop = () => {
            if (!window.mmxKeepAliveRunning) {
                window.mmxKeepAliveId = null;
                return;
            }

            // Ghi lại tick cuối cùng để debug / watchdog nếu cần
            window.mmxLastKeepAliveTick = performance.now();

            try {
                window.mmxKeepAliveId = requestAnimationFrame(loop);
            } catch (e) {
                window.mmxKeepAliveRunning = false;
                window.mmxKeepAliveId = null;
            }
        };

        window.mmxKeepAliveId = requestAnimationFrame(loop);
        // Log đã được ẩn để bảo mật
        // if (typeof addLogEntry === 'function') {
        //     addLogEntry('🩺 Keep-Alive: Đã kích hoạt vòng requestAnimationFrame để giữ tốc độ render ổn định.', 'info');
        // }
    } catch (e) {
        console.warn('Không thể khởi động keep-alive loop:', e);
    }
}

// Helper: set value cho textarea theo kiểu "React-friendly"
// Dùng native setter để cập nhật cả DOM lẫn React state bên trong
function setReactTextareaValue(el, value) {
    if (!el) return;
    try {
        // Ưu tiên getter/setter ngay trên prototype thực tế của element
        const proto = Object.getPrototypeOf(el) || HTMLTextAreaElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
                     Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        if (desc && typeof desc.set === 'function') {
            desc.set.call(el, value);
        } else {
            el.value = value;
        }
    } catch (e) {
        // Fallback an toàn nếu có lỗi
        el.value = value;
    }
}

// =======================================================
// == KẾ HOẠCH PHÁT TRIỂN: GIẢI PHÁP CHỐNG TAB NGỦ ĐÔNG ==
// =======================================================
// Vấn đề: Khi tab bị thu nhỏ hoặc ẩn, trình duyệt sẽ throttle timers,
// khiến vòng lặp "set text 8 lần" (mỗi lần 50ms) bị kéo dài thành 30 giây.
//
// Giải pháp đa lớp:
// 1. Silent Audio: Phát âm thanh câm liên tục để giữ tab active
// 2. requestAnimationFrame: Giữ animation loop chạy
// 3. Visibility API: Theo dõi và cảnh báo khi tab bị ẩn
// 4. Web Worker (tùy chọn): Chạy timers trong background thread
// =======================================================

// Tạo AudioContext và buffer âm thanh câm (Silent Audio)
let silentAudioContext = null;
let silentAudioSource = null;
let silentAudioBuffer = null;
let keepAliveInterval = null;

// Hàm tạo âm thanh câm (Silent Audio)
function createSilentAudio() {
    try {
        // Tạo AudioContext
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            console.warn('[KEEP-ALIVE] AudioContext không được hỗ trợ');
            return false;
        }
        
        silentAudioContext = new AudioContextClass();
        
        // Tạo buffer âm thanh câm (1 giây, 44.1kHz, mono)
        const sampleRate = silentAudioContext.sampleRate;
        const length = sampleRate * 1; // 1 giây
        silentAudioBuffer = silentAudioContext.createBuffer(1, length, sampleRate);
        
        // Buffer đã được tạo với giá trị 0 (âm thanh câm)
        // Không cần fill vì mặc định đã là 0
        
        // Log đã được ẩn để bảo mật
        // if (typeof addLogEntry === 'function') {
        //     addLogEntry('🔇 [KEEP-ALIVE] Đã tạo Silent Audio buffer', 'info');
        // }
        return true;
    } catch (e) {
        console.warn('[KEEP-ALIVE] Lỗi tạo Silent Audio:', e);
        return false;
    }
}

// Hàm phát âm thanh câm liên tục
function playSilentAudio() {
    try {
        if (!silentAudioContext || !silentAudioBuffer) {
            if (!createSilentAudio()) {
                return;
            }
        }
        
        // Tạo source mới mỗi lần phát
        if (silentAudioSource) {
            try {
                silentAudioSource.stop();
            } catch (e) {
                // Bỏ qua nếu đã stop
            }
        }
        
        silentAudioSource = silentAudioContext.createBufferSource();
        silentAudioSource.buffer = silentAudioBuffer;
        silentAudioSource.connect(silentAudioContext.destination);
        silentAudioSource.loop = true;
        silentAudioSource.start(0);
        
    } catch (e) {
        // Nếu AudioContext bị suspended, resume nó
        if (silentAudioContext && silentAudioContext.state === 'suspended') {
            silentAudioContext.resume().catch(() => {});
        }
    }
}

// Hàm dừng âm thanh câm
function stopSilentAudio() {
    try {
        if (silentAudioSource) {
            silentAudioSource.stop();
            silentAudioSource = null;
        }
        if (silentAudioContext && silentAudioContext.state !== 'closed') {
            silentAudioContext.suspend();
        }
    } catch (e) {
        // Bỏ qua lỗi
    }
}

// Hàm start keep-alive với Silent Audio + requestAnimationFrame
function startKeepAliveLoop() {
    try {
        if (window.mmxKeepAliveRunning) return; // Đã chạy
        window.mmxKeepAliveRunning = true;
        
        // 1. Khởi tạo Silent Audio
        createSilentAudio();
        playSilentAudio();
        
        // 2. requestAnimationFrame loop
        let rafId = null;
        const rafLoop = () => {
            if (!window.mmxKeepAliveRunning) {
                if (rafId) cancelAnimationFrame(rafId);
                return;
            }
            window.mmxLastKeepAliveTick = performance.now();
            rafId = requestAnimationFrame(rafLoop);
        };
        rafId = requestAnimationFrame(rafLoop);
        window.mmxKeepAliveId = rafId;
        
        // 3. Interval để phát lại Silent Audio mỗi 5 giây (đảm bảo không bị dừng)
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
        }
        keepAliveInterval = setInterval(() => {
            if (window.mmxKeepAliveRunning) {
                playSilentAudio();
            } else {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
            }
        }, 5000); // Phát lại mỗi 5 giây
        
        // 4. Theo dõi visibility để cảnh báo (đã ẩn log để bảo mật)
        const handleVisibilityChange = () => {
            // Log đã được ẩn để bảo mật
            // if (document.hidden) {
            //     if (typeof addLogEntry === 'function') {
            //         addLogEntry('⚠️ [KEEP-ALIVE] Tab bị ẩn! Silent Audio đang hoạt động để giữ tab active...', 'warning');
            //     }
            // } else {
            //     if (typeof addLogEntry === 'function') {
            //         addLogEntry('✅ [KEEP-ALIVE] Tab đã hiện lại', 'info');
            //     }
            // }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Log đã được ẩn để bảo mật
        // if (typeof addLogEntry === 'function') {
        //     addLogEntry('🩺 [KEEP-ALIVE] Đã kích hoạt: Silent Audio + requestAnimationFrame để giữ tab active', 'info');
        // }
    } catch (e) {
        console.warn('[KEEP-ALIVE] Không thể khởi động:', e);
    }
}

// Hàm stop keep-alive (CHỈ DỪNG KHI TOOL BỊ TẮT)
function stopKeepAliveLoop() {
    try {
        window.mmxKeepAliveRunning = false;
        
        // Dừng requestAnimationFrame
        if (window.mmxKeepAliveId && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(window.mmxKeepAliveId);
        }
        window.mmxKeepAliveId = null;
        
        // Dừng interval
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
        
        // Dừng Silent Audio
        stopSilentAudio();
        
        // Log đã được ẩn để bảo mật
        // if (typeof addLogEntry === 'function') {
        //     addLogEntry('🛑 [KEEP-ALIVE] Đã dừng hoàn toàn: Silent Audio + requestAnimationFrame (tool bị tắt)', 'info');
        // }
    } catch (e) {
        console.warn('[KEEP-ALIVE] Không thể dừng:', e);
    }
}

// =======================================================
// == KHỞI ĐỘNG SILENT AUDIO NGAY KHI SCRIPT ĐƯỢC LOAD ==
// == Chạy 100% thời gian, chỉ dừng khi tool bị tắt ==
// =======================================================
(function initKeepAliveOnLoad() {
    try {
        // Đợi DOM sẵn sàng (nếu chưa sẵn)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    startKeepAliveLoop();
                    console.log('[KEEP-ALIVE] Đã khởi động Silent Audio ngay khi tool load (chạy 100% thời gian)');
                }, 1000); // Đợi 1 giây để đảm bảo mọi thứ đã sẵn sàng
            });
        } else {
            // DOM đã sẵn sàng, khởi động ngay
            setTimeout(() => {
                startKeepAliveLoop();
                console.log('[KEEP-ALIVE] Đã khởi động Silent Audio ngay khi tool load (chạy 100% thời gian)');
            }, 1000);
        }
        
        // Dừng khi trang bị đóng (beforeunload)
        window.addEventListener('beforeunload', () => {
            stopKeepAliveLoop();
        });
        
        // Dừng khi trang bị unload (backup)
        window.addEventListener('unload', () => {
            stopKeepAliveLoop();
        });
        
        // Dừng khi visibility change thành hidden và không quay lại sau 5 phút (backup)
        let hiddenStartTime = null;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                hiddenStartTime = Date.now();
            } else {
                hiddenStartTime = null;
            }
        });
        
        // Kiểm tra định kỳ nếu tab bị ẩn quá lâu (backup safety)
        setInterval(() => {
            if (document.hidden && hiddenStartTime && (Date.now() - hiddenStartTime > 300000)) {
                // Tab bị ẩn quá 5 phút, nhưng vẫn giữ Silent Audio chạy
                // Log đã được ẩn để bảo mật
                // if (typeof addLogEntry === 'function') {
                //     addLogEntry('⏰ [KEEP-ALIVE] Tab đã bị ẩn hơn 5 phút, nhưng Silent Audio vẫn hoạt động để giữ tab active', 'info');
                // }
            }
        }, 60000); // Kiểm tra mỗi phút
        
    } catch (e) {
        console.warn('[KEEP-ALIVE] Lỗi khởi động tự động:', e);
    }
})();

async function uSTZrHUt_IC() {
    const tQqGbytKzpHwhGmeQJucsrq = AP$u_huhInYfTj;
    
    // Kiểm tra và reset MEpJezGZUsmpZdAgFRBRZW nếu cần
    if (typeof window.MEpJezGZUsmpZdAgFRBRZW !== 'undefined') {
        MEpJezGZUsmpZdAgFRBRZW = window.MEpJezGZUsmpZdAgFRBRZW;
    }
    
    if (MEpJezGZUsmpZdAgFRBRZW) {
        addLogEntry(`⏸️ [Chunk ${ttuo$y_KhCV + 1}] Đang tạm dừng, bỏ qua...`, 'info');
        return;
    }
    
    // Kiểm tra SI$acY có dữ liệu không
    // QUAN TRỌNG: Nếu SI$acY rỗng, có thể là job mới chưa được khởi tạo hoặc đã merge xong
    // Chỉ return nếu thực sự không có dữ liệu và không phải là trạng thái sau merge
    if (!SI$acY || SI$acY.length === 0) {
        // Kiểm tra xem có phải là trạng thái sau merge không (EfNjYNYj_O_CGB = false)
        if (EfNjYNYj_O_CGB === false && ttuo$y_KhCV === 0) {
            // Đây là trạng thái sau merge, không phải lỗi
            // Không log warning, chỉ return im lặng
            return;
        }
        addLogEntry(`⚠️ Không có chunks để xử lý. SI$acY.length = ${SI$acY ? SI$acY.length : 'undefined'}`, 'warning');
        return;
    }
    
    // Kiểm tra ttuo$y_KhCV có hợp lệ không
    // QUAN TRỌNG: Nếu ttuo$y_KhCV >= SI$acY.length, có thể là:
    // 1. Tất cả chunks đã thành công -> vào logic merge
    // 2. Job cũ chưa được reset -> reset về 0 để bắt đầu job mới
    if (ttuo$y_KhCV >= SI$acY.length && SI$acY.length > 0) {
        // Kiểm tra xem tất cả chunks đã thành công chưa
        const allChunksSuccess = window.chunkStatus && window.chunkStatus.length === SI$acY.length && 
                                 window.chunkStatus.every((status, idx) => {
                                     return status === 'success' && window.chunkBlobs && window.chunkBlobs[idx] !== null;
                                 });
        
        if (allChunksSuccess) {
            // Tất cả chunks đã thành công, không reset về 0 - để logic merge xử lý
            // Logic merge sẽ được gọi ở phần dưới (dòng 4337)
            // Không log gì để tránh spam log
        } else {
            // Chưa thành công hết, có thể là job cũ chưa được reset
            // Reset về 0 để bắt đầu job mới
            addLogEntry(`🔄 Phát hiện ttuo$y_KhCV (${ttuo$y_KhCV}) >= SI$acY.length (${SI$acY.length}) nhưng chưa thành công hết. Reset về 0 để bắt đầu job mới.`, 'warning');
            ttuo$y_KhCV = 0;
        }
    } else if (ttuo$y_KhCV >= SI$acY.length && SI$acY.length === 0) {
        // SI$acY rỗng, có thể là job mới chưa được khởi tạo
        // Reset về 0 để sẵn sàng
        addLogEntry(`🔄 Phát hiện SI$acY rỗng và ttuo$y_KhCV = ${ttuo$y_KhCV}. Reset về 0.`, 'warning');
        ttuo$y_KhCV = 0;
    }
    
    // Đảm bảo keep-alive loop đang chạy (đã được khởi động tự động khi tool load)
    // Nếu chưa chạy (do lỗi hoặc chưa kịp khởi động), sẽ khởi động ngay
    if (!window.mmxKeepAliveRunning) {
        startKeepAliveLoop();
    }
    // GUARD: Kiểm tra độ sâu recursive calls ở đầu hàm
    if (typeof window.recursiveCallDepth === 'undefined') {
        window.recursiveCallDepth = 0;
    }
    if (typeof window.maxRecursiveDepth === 'undefined') {
        window.maxRecursiveDepth = 50;
    }
    
    window.recursiveCallDepth++;
    if (window.recursiveCallDepth > window.maxRecursiveDepth) {
        addLogEntry(`⚠️ Đã đạt độ sâu recursive tối đa (${window.maxRecursiveDepth}), reset và chờ 2 giây...`, 'warning');
        window.recursiveCallDepth = 0;
        setTimeout(() => {
            window.recursiveCallDepth = 0;
            uSTZrHUt_IC();
        }, 2000);
        return;
    }

    // Logic xử lý khi đã hoàn thành tất cả các chunk
    // QUAN TRỌNG: Kiểm tra cả SI$acY.length để đảm bảo không bị lỗi khi SI$acY rỗng hoặc undefined
    const totalChunksCount = SI$acY && SI$acY.length ? SI$acY.length : 0;
    if (totalChunksCount === 0) {
        addLogEntry(`⚠️ SI$acY rỗng hoặc không có chunks. Dừng xử lý.`, 'warning');
        return;
    }
    
    if (ttuo$y_KhCV >= totalChunksCount) {
        // Kiểm tra xem tất cả chunk đã được xử lý đầy đủ chưa
        const totalChunks = SI$acY.length;
        const processedChunks = window.chunkStatus ? window.chunkStatus.filter(status => status === 'success' || status === 'failed').length : 0;
        const failedChunks = window.failedChunks || [];

        addLogEntry(`📊 Kiểm tra: ${processedChunks}/${totalChunks} chunks đã được xử lý`, 'info');

        // CẢI THIỆN: Nếu chưa xử lý đủ chunk, tìm và xử lý chunk còn thiếu
        // QUAN TRỌNG: Chỉ xử lý khi thực sự có chunk chưa được xử lý VÀ không đang được xử lý
        // Đồng bộ trạng thái dựa trên CẢ chunkStatus và window.chunkBlobs để tránh lệch trạng thái
        if (processedChunks < totalChunks) {
            const processingChunks = window.processingChunks || new Set();
            const missingByBlob = [];   // Chunk bị đánh dấu success nhưng blob null / thiếu
            const missingByStatus = []; // Chunk pending/undefined hoặc failed nhưng chưa có timeout

            for (let i = 0; i < totalChunks; i++) {
                const status = window.chunkStatus && window.chunkStatus[i];
                const blob = window.chunkBlobs && window.chunkBlobs[i];
                const hasTimeout = window.chunkTimeoutIds && window.chunkTimeoutIds[i];

                // Một chunk chỉ được coi là "đã xử lý" khi VỪA có blob VỪA có status success/failed
                const isProcessed = !!blob && (status === 'success' || status === 'failed');

                if (!isProcessed) {
                    // Bỏ qua những chunk đang xử lý hoặc đang có timeout
                    if (processingChunks.has(i) || hasTimeout) continue;

                    // ƯU TIÊN 1: Những chunk bị đánh dấu success nhưng blob bị null => lỗi thiếu blob
                    if (!blob && status === 'success') {
                        missingByBlob.push(i);
                    } else {
                        // ƯU TIÊN 2: Những chunk pending/undefined/failed chưa có blob hợp lệ
                        missingByStatus.push(i);
                    }
                }
            }

            // Ưu tiên xử lý các chunk bị thiếu blob trước, sau đó mới đến các chunk pending
            const remainingChunks = missingByBlob.length > 0 ? missingByBlob : missingByStatus;

            if (remainingChunks.length > 0) {
                // CHỈ reset khi có chunk thực sự chưa được xử lý (không đang trong quá trình xử lý)
                addLogEntry(`⏳ Phát hiện ${remainingChunks.length} chunk chưa được xử lý (không đang xử lý, có thể thiếu blob): ${remainingChunks.map(i => i + 1).join(', ')}`, 'warning');
                addLogEntry(`🔄 Kích hoạt cơ chế xử lý chunk thiếu: Reset giao diện và nhảy đến chunk chưa xử lý...`, 'info');
                
                // Khởi tạo biến retry nếu chưa có
                if (typeof window.totalRetryAttempts === 'undefined') window.totalRetryAttempts = 0;
                if (typeof window.missingChunkRetryCount === 'undefined') window.missingChunkRetryCount = 0;
                
                window.missingChunkRetryCount++;
                window.totalRetryAttempts++;
                addLogEntry(`📊 Thống kê: Đã thử xử lý chunk thiếu ${window.missingChunkRetryCount} lần`, 'info');
                addLogEntry(`⏳ Tool sẽ retry VÔ HẠN cho đến khi TẤT CẢ chunk được xử lý!`, 'info');
                
                // Sử dụng async IIFE để xử lý reset và nhảy đến chunk thiếu
                (async () => {
                    try {
                        // 1. Reset giao diện: Tìm và click nút "Tạo lại"/"Regenerate"
                        await resetWebInterface();
                        
                        // 2. Tìm chunk chưa xử lý đầu tiên
                        const nextUnprocessedIndex = Math.min(...remainingChunks);
                        
                        // 3. Nhảy thẳng đến chunk chưa xử lý đầu tiên
                        ttuo$y_KhCV = nextUnprocessedIndex;
                        addLogEntry(`🔄 MISSING CHUNK MODE: Nhảy thẳng đến chunk ${nextUnprocessedIndex + 1} (chunk chưa xử lý đầu tiên)`, 'info');
                        addLogEntry(`📋 Sẽ xử lý các chunk còn thiếu: ${remainingChunks.map(i => i + 1).join(', ')}`, 'info');
                        
                        // 4. Chờ 2 giây rồi bắt đầu xử lý
                        setTimeout(uSTZrHUt_IC, 2000);
                    } catch (error) {
                        addLogEntry(`❌ Lỗi khi xử lý chunk thiếu: ${error.message}`, 'error');
                        // Retry lại sau 3 giây nếu có lỗi
                        setTimeout(uSTZrHUt_IC, 3000);
                    }
                })();
                return;
            } else {
                // Nếu không tìm thấy chunk chưa xử lý (có thể đang được xử lý), tiếp tục chờ
                const pendingButProcessing = totalChunks - processedChunks;
                addLogEntry(`⏳ Còn ${pendingButProcessing} chunk chưa hoàn thành (có thể đang được xử lý). Tiếp tục chờ...`, 'info');
                setTimeout(uSTZrHUt_IC, 2000);
                return;
            }
        }

        // CƠ CHẾ RETRY MỚI: Mỗi chunk tự retry vô hạn khi lỗi, không cần phase retry riêng
        // Kiểm tra xem tất cả chunks đã thành công chưa
        const expectedChunkCount = SI$acY ? SI$acY.length : 0;
        
        // QUAN TRỌNG: Kiểm tra số lượng chunk có đủ không
        if (expectedChunkCount === 0) {
            addLogEntry(`⚠️ Không có chunks để kiểm tra. SI$acY.length = 0`, 'warning');
            return;
        }
        
        // Đảm bảo chunkStatus có đủ phần tử
        if (!window.chunkStatus || window.chunkStatus.length < expectedChunkCount) {
            addLogEntry(`⚠️ chunkStatus chưa đủ phần tử (${window.chunkStatus ? window.chunkStatus.length : 0}/${expectedChunkCount}). Tiếp tục xử lý...`, 'warning');
            return;
        }
        
        // Kiểm tra từng chunk: phải có status 'success' VÀ có blob hợp lệ
        const allChunksSuccess = window.chunkStatus.every((status, idx) => {
            // Chunk đã được xử lý và có blob hợp lệ
            const hasBlob = window.chunkBlobs && window.chunkBlobs[idx] !== null && window.chunkBlobs[idx] !== undefined;
            return status === 'success' && hasBlob;
        });
        
        // Kiểm tra số lượng chunk có đủ không
        const validChunkCount = window.chunkBlobs ? window.chunkBlobs.filter(blob => blob !== null && blob !== undefined).length : 0;
        
        if (allChunksSuccess && window.chunkStatus.length === expectedChunkCount && validChunkCount === expectedChunkCount) {
            addLogEntry(`🎉 Tất cả ${expectedChunkCount} chunks đã được xử lý xong!`, 'success');
            addLogEntry(`✅ TẤT CẢ ${expectedChunkCount} chunks đã thành công và có đủ blob! Bắt đầu ghép file...`, 'success');
            // CHỈ ghép file khi TẤT CẢ chunk đã thành công VÀ có đủ số lượng
            tt__SfNwBHDebpWJOqrSTR();
            return;
        } else {
            // Log chi tiết nếu chưa đủ
            if (validChunkCount < expectedChunkCount) {
                addLogEntry(`⏳ Chưa đủ chunk: ${validChunkCount}/${expectedChunkCount} chunks có blob. Tiếp tục xử lý...`, 'info');
            }
        }

        // Nếu chưa xong tất cả chunks, tiếp tục xử lý chunk tiếp theo
        EfNjYNYj_O_CGB = ![];
        LrkOcBYz_$AGjPqXLWnyiATpCI[tQqGbytKzpHwhGmeQJucsrq(0x1fb)][tQqGbytKzpHwhGmeQJucsrq(0x1e1)] = tQqGbytKzpHwhGmeQJucsrq(0x258);
        lraDK$WDOgsXHRO[tQqGbytKzpHwhGmeQJucsrq(0x1fb)][tQqGbytKzpHwhGmeQJucsrq(0x1e1)] = tQqGbytKzpHwhGmeQJucsrq(0x209);
        OdKzziXLxtOGjvaBMHm[tQqGbytKzpHwhGmeQJucsrq(0x1fb)][tQqGbytKzpHwhGmeQJucsrq(0x1e1)] = tQqGbytKzpHwhGmeQJucsrq(0x209);
        LrkOcBYz_$AGjPqXLWnyiATpCI[tQqGbytKzpHwhGmeQJucsrq(0x243)] = ![];
        LrkOcBYz_$AGjPqXLWnyiATpCI[tQqGbytKzpHwhGmeQJucsrq(0x273)] = tQqGbytKzpHwhGmeQJucsrq(0x275);
        nWHrScjZnIyNYzztyEWwM(ttuo$y_KhCV, SI$acY[tQqGbytKzpHwhGmeQJucsrq(0x216)]);
    }

    nWHrScjZnIyNYzztyEWwM(ttuo$y_KhCV, SI$acY[tQqGbytKzpHwhGmeQJucsrq(0x216)]);

    // Khởi tạo hệ thống theo dõi chunk
    if (typeof window.chunkStatus === 'undefined') window.chunkStatus = [];
    if (typeof window.failedChunks === 'undefined') window.failedChunks = [];
    if (typeof window.isFinalCheck === 'undefined') window.isFinalCheck = false;
    if (typeof window.retryCount === 'undefined') window.retryCount = 0;
    if (typeof window.totalRetryAttempts === 'undefined') window.totalRetryAttempts = 0;
    // Theo dõi lỗi chunk 1 để kiểm tra cấu hình
    if (typeof window.chunk1Failed === 'undefined') window.chunk1Failed = false;
    // Reset processingChunks để tránh xử lý trùng lặp
    window.processingChunks = new Set();

    // Đảm bảo mảng chunkStatus có đủ phần tử
    while (window.chunkStatus.length < SI$acY.length) {
        window.chunkStatus.push('pending');
    }

        // Logic thông minh: Tìm nút và click với retry
        try {
        // BẢO VỆ: Nếu không ở chế độ retry cuối và chunk này đã success + có blob, bỏ qua và nhảy sang chunk tiếp theo
        if (!window.isFinalCheck) {
            const status = window.chunkStatus && window.chunkStatus[ttuo$y_KhCV];
            const blob = window.chunkBlobs && window.chunkBlobs[ttuo$y_KhCV];
            if (blob && status === 'success') {
                // Kiểm tra xem tất cả chunks đã thành công chưa
                const allChunksSuccess = window.chunkStatus && window.chunkStatus.length === SI$acY.length && 
                                         window.chunkStatus.every((s, idx) => {
                                             return s === 'success' && window.chunkBlobs && window.chunkBlobs[idx] !== null;
                                         });
                
                if (allChunksSuccess) {
                    // Tất cả chunks đã thành công, không tăng ttuo$y_KhCV nữa, để logic merge xử lý
                    addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã thành công. Tất cả chunks đã hoàn thành, chuyển sang merge.`, 'success');
                    // Set ttuo$y_KhCV để vào nhánh merge
                    ttuo$y_KhCV = SI$acY.length;
                    setTimeout(uSTZrHUt_IC, 100);
                    return;
                } else {
                    // Chưa thành công hết, nhảy sang chunk tiếp theo
                addLogEntry(`⏭️ [Chunk ${ttuo$y_KhCV + 1}] Đã có blob hợp lệ và trạng thái 'success', bỏ qua và nhảy sang chunk tiếp theo`, 'info');
                ttuo$y_KhCV++;
                // Nếu đã vượt quá số chunk, đánh dấu hoàn thành và gọi lại uSTZrHUt_IC để vào nhánh kiểm tra cuối
                if (ttuo$y_KhCV >= SI$acY.length) {
                    ttuo$y_KhCV = SI$acY.length;
                }
                setTimeout(uSTZrHUt_IC, getRandomChunkDelay());
                return;
                }
            }
        }
        // Nếu đang trong giai đoạn kiểm tra cuối (RETRY MODE)
        if (window.isFinalCheck) {
            // QUAN TRỌNG: Chỉ xử lý các chunk thất bại, bỏ qua các chunk đã thành công
            // Kiểm tra xem chunk hiện tại có trong danh sách failedChunks không
            if (!window.failedChunks.includes(ttuo$y_KhCV)) {
                // Chunk này không phải chunk lỗi, nhảy thẳng đến chunk lỗi tiếp theo
                const remainingFailedChunks = window.failedChunks.filter(idx => idx > ttuo$y_KhCV);
                if (remainingFailedChunks.length > 0) {
                    const nextFailedIndex = Math.min(...remainingFailedChunks);
                    addLogEntry(`⏭️ [Chunk ${ttuo$y_KhCV + 1}] Đã thành công, nhảy thẳng đến chunk ${nextFailedIndex + 1} (chunk lỗi tiếp theo)`, 'info');
                    ttuo$y_KhCV = nextFailedIndex;
                } else {
                    // Không còn chunk lỗi nào, kết thúc
                    addLogEntry(`✅ Đã xử lý xong tất cả chunks lỗi!`, 'success');
                    ttuo$y_KhCV = SI$acY.length; // Đánh dấu hoàn thành
                    setTimeout(uSTZrHUt_IC, 1000);
                    return;
                }
            }
            
            // QUAN TRỌNG: Kiểm tra lại sau khi nhảy đến chunk lỗi
            // Nếu chunk hiện tại đã thành công (có thể đã được xử lý trong lần retry trước), nhảy đến chunk lỗi tiếp theo
            if (window.chunkStatus[ttuo$y_KhCV] === 'success') {
                // Chunk này đã thành công
                if (window.failedChunks.includes(ttuo$y_KhCV)) {
                    // Chunk này đã thành công nhưng vẫn trong danh sách failedChunks (chưa được loại bỏ)
                    // Loại bỏ khỏi danh sách failedChunks
                    window.failedChunks = window.failedChunks.filter(idx => idx !== ttuo$y_KhCV);
                    addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã thành công, loại bỏ khỏi danh sách lỗi`, 'success');
                }
                
                // Nhảy đến chunk lỗi tiếp theo (bỏ qua chunk đã thành công)
                const remainingFailedChunks = window.failedChunks.filter(idx => idx > ttuo$y_KhCV);
                if (remainingFailedChunks.length > 0) {
                    const nextFailedIndex = Math.min(...remainingFailedChunks);
                    addLogEntry(`⏭️ [Chunk ${ttuo$y_KhCV + 1}] Đã thành công, nhảy thẳng đến chunk ${nextFailedIndex + 1} (chunk lỗi tiếp theo)`, 'info');
                    ttuo$y_KhCV = nextFailedIndex;
                } else {
                    // Không còn chunk lỗi nào, kết thúc
                    addLogEntry(`✅ Đã xử lý xong tất cả chunks lỗi!`, 'success');
                    ttuo$y_KhCV = SI$acY.length; // Đánh dấu hoàn thành
                    setTimeout(uSTZrHUt_IC, 1000);
                    return;
                }
            }
        }

        // CƠ CHẾ RETRY MỚI: Mỗi chunk tự retry vô hạn khi lỗi, không cần kiểm tra isFinalCheck
        // Nếu chunk này đã thành công và có blob hợp lệ, bỏ qua và chuyển sang chunk tiếp theo
        if (window.chunkStatus && window.chunkStatus[ttuo$y_KhCV] === 'success' && 
            window.chunkBlobs && window.chunkBlobs[ttuo$y_KhCV] !== null) {
            addLogEntry(`⏭️ [Chunk ${ttuo$y_KhCV + 1}] Đã thành công, chuyển sang chunk tiếp theo`, 'info');
            ttuo$y_KhCV++;
            if (ttuo$y_KhCV >= SI$acY.length) {
                // Đã xử lý xong tất cả chunks
                addLogEntry(`✅ Đã xử lý xong tất cả chunks!`, 'success');
                ttuo$y_KhCV = SI$acY.length;
                setTimeout(uSTZrHUt_IC, 1000);
                return;
            }
            setTimeout(uSTZrHUt_IC, getRandomChunkDelay());
            return;
        }

        // Logic thông minh: Tìm bất kỳ nút nào có sẵn để gửi chunk
        // Thay vì tìm kiếm cứng nhắc, script sẽ tìm nút Generate hoặc Regenerate tùy theo nút nào có sẵn
        const possibleGenerateTexts = ['Generate', 'Tạo'];
        const possibleRegenerateTexts = ['Regenerate', 'Tạo lại'];
        const allButtonTexts = [...possibleGenerateTexts, ...possibleRegenerateTexts];
        
        // Ưu tiên: Nếu chunk = 0 thì ưu tiên Generate, nếu chunk > 0 thì ưu tiên Regenerate
        // Nhưng nếu không tìm thấy nút ưu tiên, sẽ tìm bất kỳ nút nào có sẵn
        let targetButton = null;
        let preferredButtonTexts = (ttuo$y_KhCV === 0) ? possibleGenerateTexts : possibleRegenerateTexts;
        
        // Chờ bất kỳ nút nào xuất hiện trước (nhanh hơn)
        addLogEntry(`🔍 [Chunk ${ttuo$y_KhCV + 1}] Đang chờ nút xuất hiện...`, 'info');
        await waitForButton(allButtonTexts); // Chờ bất kỳ nút nào xuất hiện
        
        // Sau khi nút đã xuất hiện, tìm nút ưu tiên hoặc bất kỳ nút nào có sẵn
        const stableButtonSelector = '.clone-voice-ux-v2 button.ant-btn, button[class*="ant-btn"], .ant-btn, button';
        const buttons = document.querySelectorAll(stableButtonSelector);
        
        let preferredButton = null;
        let anyAvailableButton = null;
        
        for (const btn of buttons) {
            if (btn.offsetParent === null || btn.disabled) continue; // Bỏ qua nút ẩn hoặc bị khóa
            
            const btnText = (btn.textContent || btn.innerText || '').toLowerCase().trim();
            
            // Kiểm tra nút ưu tiên
            if (!preferredButton && preferredButtonTexts.some(text => btnText.includes(text.toLowerCase()))) {
                preferredButton = btn;
            }
            
            // Kiểm tra bất kỳ nút nào
            if (!anyAvailableButton && allButtonTexts.some(text => btnText.includes(text.toLowerCase()))) {
                anyAvailableButton = btn;
            }
        }
        
        // Sử dụng nút ưu tiên nếu có, nếu không thì dùng nút có sẵn
        if (preferredButton) {
            targetButton = preferredButton;
            addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã tìm thấy nút ưu tiên: "${targetButton.textContent}"`, 'success');
        } else if (anyAvailableButton) {
            targetButton = anyAvailableButton;
            addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã tìm thấy nút thay thế: "${targetButton.textContent}" (nút ưu tiên không có sẵn)`, 'success');
        } else {
            throw new Error(`Không tìm thấy bất kỳ nút nào để gửi chunk!`);
        }

        // ANTI-DETECTION: Thêm delay ngẫu nhiên trước khi đặt text
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        
        // =======================================================
        // == CLEAR TEXTAREA VÀ AUDIO CONTEXT TRƯỚC KHI GỬI CHUNK ==
        // =======================================================
        // Clear textarea để tránh lỗi âm thanh lạ khi render
        const textarea = document.getElementById('gemini-hidden-text-for-request');
        if (textarea) {
            setReactTextareaValue(textarea, '');
            addLogEntry(`🧹 [Chunk ${ttuo$y_KhCV + 1}] Đã clear textarea trước khi gửi`, 'info');
        }
        
        // Clear audio context và các audio elements để tránh lỗi âm thanh lạ
        try {
            // Dừng tất cả các audio elements đang phát
            const audioElements = document.querySelectorAll('audio');
            let stoppedCount = 0;
            audioElements.forEach(audio => {
                try {
                    if (!audio.paused) {
                        audio.pause();
                        audio.currentTime = 0;
                        stoppedCount++;
                    }
                    // Reset audio source nếu có
                    if (audio.src) {
                        audio.src = '';
                    }
                } catch (e) {
                    // Bỏ qua lỗi từng audio element
                }
            });
            
            // Clear source elements
            const sourceElements = document.querySelectorAll('source');
            sourceElements.forEach(source => {
                try {
                    if (source.src) {
                        source.src = '';
                    }
                } catch (e) {
                    // Bỏ qua lỗi
                }
            });
            
            // Clear Web Audio API context nếu có (thông qua window)
            if (window.audioContext) {
                try {
                    if (window.audioContext.state !== 'closed') {
                        window.audioContext.close();
                    }
                    window.audioContext = null;
                } catch (e) {
                    // Bỏ qua nếu không thể đóng
                }
            }
            
            // Clear các biến audio context khác có thể có
            if (window.AudioContext || window.webkitAudioContext) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                // Tìm và clear các AudioContext được lưu trong window
                Object.keys(window).forEach(key => {
                    try {
                        const value = window[key];
                        if (value && typeof value === 'object' && typeof value.close === 'function' && typeof value.state === 'string') {
                            // Có thể là AudioContext
                            if (value.state !== 'closed') {
                                value.close();
                            }
                            window[key] = null;
                        }
                    } catch (e) {
                        // Bỏ qua
                    }
                });
            }
            
            if (stoppedCount > 0) {
                addLogEntry(`🧹 [Chunk ${ttuo$y_KhCV + 1}] Đã dừng ${stoppedCount} audio element(s) và clear audio context`, 'info');
            }
        } catch (audioError) {
            addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Lỗi khi clear audio: ${audioError.message}`, 'warning');
        }
        
        // Chờ một chút để đảm bảo clear hoàn tất
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // =======================================================
        // == CHUẨN HÓA VĂN BẢN TRƯỚC KHI GỬI CHUNK ==
        // =======================================================
        // Áp dụng chuẩn hóa cho chunk trước khi gửi
        // DEBUG: Đảm bảo hàm được gọi
        console.log(`[DEBUG] Đang chuẩn hóa chunk ${ttuo$y_KhCV + 1}, độ dài: ${SI$acY[ttuo$y_KhCV].length}`);
        const chunkText = normalizeChunkText(SI$acY[ttuo$y_KhCV]);
        console.log(`[DEBUG] Sau chuẩn hóa, độ dài: ${chunkText.length}`);

        // LƯU LẠI ĐỘ DÀI VĂN BẢN ĐÃ CHUẨN HÓA ĐỂ KIỂM TRA SAU KHI GỬI
        try {
            if (!window.expectedChunkLengths) {
                window.expectedChunkLengths = {};
            }
            window.expectedChunkLengths[ttuo$y_KhCV] = chunkText.length;
            addLogEntry(`🧩 [Chunk ${ttuo$y_KhCV + 1}] Ghi nhớ độ dài sau chuẩn hóa: ${chunkText.length} ký tự`, 'info');
        } catch (e) {
            console.warn('Không thể lưu expectedChunkLengths:', e);
        }
        
        // LƯU TEXT CHUNK ĐÚNG VÀO WINDOW ĐỂ NETWORK INTERCEPTOR CÓ THỂ SỬ DỤNG
        try {
            window.currentChunkText = chunkText;
            window.currentChunkIndex = ttuo$y_KhCV;
            
            // --- FIX BY GEMINI: LUÔN SET INTERCEPT_CURRENT_TEXT ---
            // Bỏ điều kiện USE_PAYLOAD_MODE để đảm bảo 100% không có chunk nào bị bỏ qua
            // Interceptor sẽ luôn có dữ liệu để thay thế, không phụ thuộc vào cài đặt
            window.INTERCEPT_CURRENT_TEXT = chunkText;
            window.INTERCEPT_CURRENT_INDEX = ttuo$y_KhCV;
        } catch (e) {
            console.warn('Không thể lưu currentChunkText:', e);
        }
        
        // =======================================================
        // == KIỂM TRA: NGĂN GỬI CHUNK NHIỀU LẦN ==
        // =======================================================
        if (window.sendingChunk === ttuo$y_KhCV) {
            addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Đang được gửi, bỏ qua lần gọi trùng lặp này`, 'warning');
            return; // Đã đang gửi chunk này, không gửi lại
        }
        
        // Đánh dấu đang gửi chunk này
        window.sendingChunk = ttuo$y_KhCV;
        addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Bắt đầu gửi chunk...`, 'info');
        
        // Cập nhật progress bar
        nWHrScjZnIyNYzztyEWwM(ttuo$y_KhCV, SI$acY[tQqGbytKzpHwhGmeQJucsrq(0x216)]);
        addLogEntry(`📦 [Chunk ${ttuo$y_KhCV + 1}/${SI$acY.length}] Đang gửi đi...`, 'info');

        // ANTI-DETECTION: Thêm delay ngẫu nhiên trước khi đặt text
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        
        // =======================================================
        // == XỬ LÝ TEXTAREA: CHẾ ĐỘ MỚI (PAYLOAD MODE) vs CHẾ ĐỘ CŨ ==
        // =======================================================
        let textObserver = null;
        let isSettingText = false;
        
        if (window.USE_PAYLOAD_MODE) {
            // CHẾ ĐỘ MỚI: Set text thật vào textarea một lần ngắn gọn, sau đó interceptor sẽ thay trong payload
            // Log đã được ẩn để bảo mật
            // addLogEntry(`🚀 [Chunk ${ttuo$y_KhCV + 1}] Đang dùng chế độ PAYLOAD MODE - Set text thật vào textarea một lần, sau đó thay trong payload`, 'info');
            
            // Set text thật vào textarea một lần để Minimax validate, nhưng không giữ lâu
            // Interceptor sẽ đảm bảo payload có text thật khi gửi đi
            try {
                // Set text thật vào textarea một lần (ngắn gọn, không cần giữ lâu)
                setReactTextareaValue(rUxbIRagbBVychZ$GfsogD, chunkText);
                // Chờ một chút để đảm bảo set hoàn tất
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Trigger event để website nhận biết
                try {
                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                    rUxbIRagbBVychZ$GfsogD.dispatchEvent(inputEvent);
                } catch (e) {
                    // Bỏ qua
                }
                
                // Log đã được ẩn để bảo mật
                // addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã set text thật vào textarea một lần. Interceptor sẽ đảm bảo payload có text thật khi gửi`, 'info');
            } catch (e) {
                addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Lỗi khi set text vào textarea: ${e.message}`, 'warning');
            }
        } else {
            // CHẾ ĐỘ CŨ: Set text đầy đủ vào textarea như trước
            addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Đang dùng chế độ CŨ - Set text vào textarea`, 'info');
            
            // Lớp 1: MutationObserver theo dõi textarea và tự động set lại nếu bị thay đổi
        try {
            textObserver = new MutationObserver((mutations) => {
                // Chỉ xử lý nếu không phải đang set text từ tool
                if (isSettingText) return;
                
                const currentText = rUxbIRagbBVychZ$GfsogD[tQqGbytKzpHwhGmeQJucsrq(0x24c)];
                
                // Nếu text bị thay đổi và không phải text của chunk, set lại ngay
                if (currentText !== chunkText && currentText.length > 0) {
                    // Kiểm tra xem có phải văn bản mặc định không (chứa các từ khóa)
                    const defaultTextKeywords = ['delighted', 'assist', 'voice services', 'choose a voice', 'creative audio journey'];
                    const isDefaultText = defaultTextKeywords.some(keyword => 
                        currentText.toLowerCase().includes(keyword.toLowerCase())
                    );
                    
                    if (isDefaultText || currentText !== chunkText) {
                        isSettingText = true;
                        setReactTextareaValue(rUxbIRagbBVychZ$GfsogD, chunkText);
                        addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] MutationObserver phát hiện text bị thay đổi, đã tự động set lại`, 'warning');
                        
                        // Trigger event
                        try {
                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                            rUxbIRagbBVychZ$GfsogD.dispatchEvent(inputEvent);
                        } catch (e) {
                            // Bỏ qua
                        }
                        
                        setTimeout(() => { isSettingText = false; }, 100);
                    }
                }
            });
            
            // Bắt đầu observe textarea
            textObserver.observe(rUxbIRagbBVychZ$GfsogD, {
                attributes: false,
                childList: false,
                subtree: false,
                characterData: true,
                characterDataOldValue: true
            });
            
            // Observe cả attribute value
            textObserver.observe(rUxbIRagbBVychZ$GfsogD, {
                attributes: true,
                attributeFilter: ['value'],
                childList: false,
                subtree: false
            });
            
            addLogEntry(`👁️ [Chunk ${ttuo$y_KhCV + 1}] Đã khởi tạo MutationObserver để theo dõi textarea`, 'info');
        } catch (observerError) {
            addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Không thể tạo MutationObserver: ${observerError.message}`, 'warning');
        }
        
        // Lớp 2: Set text nhiều lần liên tiếp (8 lần) để đảm bảo
        const SET_TEXT_COUNT = 8;
        addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Đang set text ${SET_TEXT_COUNT} lần liên tiếp để đảm bảo...`, 'info');

        // WATCHDOG: giới hạn tối đa 10 giây cho cả vòng set text 8 lần
        const MAX_SET_TEXT_DURATION_MS = 10000;
        const setTextStartTime = Date.now();
        
        for (let i = 0; i < SET_TEXT_COUNT; i++) {
            // Nếu đã quá 10 giây mà vẫn còn trong vòng lặp → coi là lỗi, đánh dấu failed và thoát
            const elapsed = Date.now() - setTextStartTime;
            if (elapsed > MAX_SET_TEXT_DURATION_MS) {
                const currentIndex = ttuo$y_KhCV;
                addLogEntry(`⏰ [Chunk ${currentIndex + 1}] Vòng set text ${SET_TEXT_COUNT} lần vượt quá ${Math.round(MAX_SET_TEXT_DURATION_MS/1000)} giây (đã chạy ~${Math.round(elapsed/1000)} giây). Đánh dấu chunk THẤT BẠI để retry và chuyển sang chunk tiếp theo.`, 'warning');

                if (!window.chunkStatus) window.chunkStatus = [];
                window.chunkStatus[currentIndex] = 'failed';

                if (!window.failedChunks) window.failedChunks = [];
                if (!window.failedChunks.includes(currentIndex)) {
                    window.failedChunks.push(currentIndex);
                }

                // Không giữ cờ sending cho chunk này nữa để hệ thống có thể retry
                if (window.sendingChunk === currentIndex) {
                    window.sendingChunk = null;
                }

                // Clear timeout render nếu đã được thiết lập cho chunk này
                if (window.chunkTimeoutIds && window.chunkTimeoutIds[currentIndex]) {
                    clearTimeout(window.chunkTimeoutIds[currentIndex]);
                    delete window.chunkTimeoutIds[currentIndex];
                }

                    // CƠ CHẾ RETRY MỚI: Reset và retry lại chunk này vô hạn, không chuyển sang chunk tiếp theo
                    addLogEntry(`🔄 [Chunk ${currentIndex + 1}] Thất bại do watchdog - Reset và retry lại chunk này vô hạn`, 'warning');
                    
                    // Reset flag sendingChunk để cho phép retry
                    if (window.sendingChunk === currentIndex) {
                        window.sendingChunk = null;
                    }
                    
                    // Clear timeout render nếu đã được thiết lập cho chunk này
                    if (window.chunkTimeoutIds && window.chunkTimeoutIds[currentIndex]) {
                        clearTimeout(window.chunkTimeoutIds[currentIndex]);
                        delete window.chunkTimeoutIds[currentIndex];
                    }
                    
                    // Cleanup data rác và reset web interface trước khi retry
                    (async () => {
                        await cleanupChunkData(currentIndex); // Cleanup data rác trước
                        await resetWebInterface(); // Reset web interface
                        addLogEntry(`🔄 [Chunk ${currentIndex + 1}] Đã cleanup và reset web, retry lại chunk này...`, 'info');
                        ttuo$y_KhCV = currentIndex; // Giữ nguyên chunk index để retry
                        setTimeout(uSTZrHUt_IC, getRandomChunkDelay()); // Retry sau delay
                    })();

                // Thoát sớm, không tiếp tục xử lý bước này nữa
                return;
            }

            isSettingText = true;
            setReactTextareaValue(rUxbIRagbBVychZ$GfsogD, chunkText); // Gán giá trị mới, không append
            
            // KEEP-ALIVE: Phát Silent Audio để giữ tab active (chống browser throttle)
            if (window.mmxKeepAliveRunning) {
                playSilentAudio();
            }
            
            // Trigger event để website nhận biết
            try {
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                rUxbIRagbBVychZ$GfsogD.dispatchEvent(inputEvent);
            } catch (e) {
                // Bỏ qua
            }
            
            // Chờ 50ms giữa các lần set
            await new Promise(resolve => setTimeout(resolve, 50));
            isSettingText = false;
        }
        
        addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã set text ${SET_TEXT_COUNT} lần liên tiếp`, 'info');
        
            // Quan sát sau khi set text: Chờ 2 giây để kiểm tra Minimax có thay đổi text không
        addLogEntry(`👁️ [Chunk ${ttuo$y_KhCV + 1}] Đang chờ 2 giây để quan sát xem Minimax có thay đổi text không...`, 'info');
        
        // KEEP-ALIVE: Phát Silent Audio trong thời gian chờ
        if (window.mmxKeepAliveRunning) {
            playSilentAudio();
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Kiểm tra text sau 2 giây
        const observedText = rUxbIRagbBVychZ$GfsogD[tQqGbytKzpHwhGmeQJucsrq(0x24c)] || '';
        if (observedText !== chunkText) {
            addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] PHÁT HIỆN: Minimax đã thay đổi text sau khi set! (Chuẩn hóa: ${chunkText.length} ký tự, Hiện tại: ${observedText.length} ký tự)`, 'warning');
            addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Đang set lại text đúng...`, 'warning');
            
            // Set lại text đúng
            isSettingText = true;
            setReactTextareaValue(rUxbIRagbBVychZ$GfsogD, chunkText);
            
            try {
                rUxbIRagbBVychZ$GfsogD.dispatchEvent(new Event('input', { bubbles: true }));
                rUxbIRagbBVychZ$GfsogD.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
                // Bỏ qua
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            isSettingText = false;
            
            // Kiểm tra lại lần nữa
            const recheckText = rUxbIRagbBVychZ$GfsogD[tQqGbytKzpHwhGmeQJucsrq(0x24c)] || '';
            if (recheckText === chunkText) {
                addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã set lại text thành công sau khi Minimax thay đổi`, 'info');
            } else {
                addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] VẪN BỊ THAY ĐỔI sau khi set lại! (${recheckText.length} ký tự). Có thể Minimax đang can thiệp mạnh.`, 'warning');
            }
        } else {
            addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Sau 2 giây quan sát: Text KHÔNG bị Minimax thay đổi (${observedText.length} ký tự)`, 'info');
        }
        
        // Lớp 3: setInterval giám sát liên tục trong 500ms trước khi click
        let monitoringInterval = null;
        let monitoringCount = 0;
        const MAX_MONITORING_COUNT = 10; // 10 lần x 50ms = 500ms
        
        monitoringInterval = setInterval(() => {
            monitoringCount++;
            
            // KEEP-ALIVE: Phát Silent Audio trong vòng lặp monitoring
            if (window.mmxKeepAliveRunning) {
                playSilentAudio();
            }
            
            const currentText = rUxbIRagbBVychZ$GfsogD[tQqGbytKzpHwhGmeQJucsrq(0x24c)];
            
            if (currentText !== chunkText) {
                // Text bị thay đổi, set lại ngay
                isSettingText = true;
                setReactTextareaValue(rUxbIRagbBVychZ$GfsogD, chunkText);
                addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] setInterval phát hiện text bị thay đổi (lần ${monitoringCount}), đã set lại`, 'warning');
                
                try {
                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                    rUxbIRagbBVychZ$GfsogD.dispatchEvent(inputEvent);
                } catch (e) {
                    // Bỏ qua
                }
                
                setTimeout(() => { isSettingText = false; }, 50);
            }
            
            // Dừng sau 500ms
            if (monitoringCount >= MAX_MONITORING_COUNT) {
                clearInterval(monitoringInterval);
                monitoringInterval = null;
            }
        }, 50); // Kiểm tra mỗi 50ms
        
        // Chờ 500ms để setInterval hoàn thành giám sát
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Dọn dẹp: Dừng setInterval nếu còn chạy
        if (monitoringInterval) {
            clearInterval(monitoringInterval);
            monitoringInterval = null;
        }
        
        // Lớp 4: Kiểm tra lần cuối và force set nếu cần
        const finalCheckText = rUxbIRagbBVychZ$GfsogD[tQqGbytKzpHwhGmeQJucsrq(0x24c)];
        let finalText = chunkText;

        // Regex lọc rác (giống logic trong normalizeChunkText)
        finalText = finalText.replace(/Hello, I'm delighted[\s\S]*?journey together/gi, "");
        finalText = finalText.replace(/Xin chào, tôi rất vui[\s\S]*?sáng tạo âm thanh nhé\.?/gi, "");
        finalText = finalText.replace(/Choose a voice that resonates with you/gi, "");
        finalText = finalText.replace(/Hãy chọn một giọng nói phù hợp/gi, "");

        if (finalText !== finalCheckText) {
            addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Kiểm tra lần cuối: Phát hiện text rác hoặc sai lệch, đã lọc sạch và set lại`, 'warning');
            isSettingText = true;
            setReactTextareaValue(rUxbIRagbBVychZ$GfsogD, finalText);

            try {
                // Gửi sự kiện 'input' và 'change' để web biết ta đã thay đổi, đè lên auto-fill
                rUxbIRagbBVychZ$GfsogD.dispatchEvent(new Event('input', { bubbles: true }));
                rUxbIRagbBVychZ$GfsogD.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
                // Bỏ qua
            }

            await new Promise(resolve => setTimeout(resolve, 50));
            isSettingText = false;
        } else {
            addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Kiểm tra lần cuối: Text đúng (${finalCheckText.length} ký tự)`, 'info');
            }
        }
        
        // =======================================================
        // KIỂM TRA TRƯỚC KHI CLICK: Đảm bảo chunk trước đã hoàn tất
        // =======================================================
        // Nếu không phải chunk đầu tiên, kiểm tra chunk trước đã có blob chưa
        if (ttuo$y_KhCV > 0) {
            const prevChunkIndex = ttuo$y_KhCV - 1;
            let prevChunkBlob = window.chunkBlobs && window.chunkBlobs[prevChunkIndex];
            let prevChunkStatus = window.chunkStatus && window.chunkStatus[prevChunkIndex];
            
            // Nếu chunk trước chưa có blob hoặc chưa thành công, đợi thêm
            if (!prevChunkBlob || prevChunkStatus !== 'success') {
                // Log trạng thái chi tiết của chunk trước
                const statusText = prevChunkStatus || 'pending';
                const hasBlob = !!prevChunkBlob;
                addLogEntry(`⏳ [Chunk ${ttuo$y_KhCV + 1}] Chunk trước (${prevChunkIndex + 1}) chưa hoàn tất. Trạng thái: ${statusText}, Có blob: ${hasBlob ? 'Có' : 'Không'}. Đang chờ...`, 'info');
                
                // Chờ tối đa 30 giây cho chunk trước hoàn tất
                const MAX_WAIT_MS = 30000;
                const waitStartTime = Date.now();
                let waited = false;
                let checkCount = 0;
                
                while ((!prevChunkBlob || prevChunkStatus !== 'success') && (Date.now() - waitStartTime) < MAX_WAIT_MS) {
                    // KEEP-ALIVE: Phát Silent Audio trong vòng lặp chờ để tránh browser throttle
                    if (window.mmxKeepAliveRunning) {
                        playSilentAudio(false); // Không log mỗi lần để tránh spam
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 500)); // Chờ 500ms mỗi lần kiểm tra
                    
                    checkCount++;
                    const elapsed = Date.now() - waitStartTime;
                    
                    // Kiểm tra lại
                    prevChunkBlob = window.chunkBlobs && window.chunkBlobs[prevChunkIndex];
                    prevChunkStatus = window.chunkStatus && window.chunkStatus[prevChunkIndex];
                    
                    // Log tiến trình mỗi 5 giây
                    if (checkCount % 10 === 0) { // Mỗi 5 giây (10 lần x 500ms)
                        const newStatusText = prevChunkStatus || 'pending';
                        const newHasBlob = !!prevChunkBlob;
                        addLogEntry(`⏳ [Chunk ${ttuo$y_KhCV + 1}] Vẫn đang chờ chunk trước (${prevChunkIndex + 1})... Đã chờ ${Math.round(elapsed/1000)}s. Trạng thái: ${newStatusText}, Có blob: ${newHasBlob ? 'Có' : 'Không'}`, 'info');
                    }
                    
                    if (prevChunkBlob && prevChunkStatus === 'success') {
                        addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Chunk trước (${prevChunkIndex + 1}) đã hoàn tất sau ${Math.round(elapsed/1000)}s. Tiếp tục...`, 'info');
                        waited = true;
                        break;
                    }
                    
                    // Nếu chunk trước bị failed, không cần chờ nữa (sẽ retry sau)
                    if (prevChunkStatus === 'failed') {
                        addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Chunk trước (${prevChunkIndex + 1}) đã bị đánh dấu FAILED. Sẽ retry sau. Tiếp tục với chunk hiện tại...`, 'warning');
                        waited = true; // Coi như đã xử lý (chunk failed sẽ được retry sau)
                        break;
                    }
                }
                
                if (!waited) {
                    const elapsed = Date.now() - waitStartTime;
                    const finalStatus = prevChunkStatus || 'pending';
                    const finalHasBlob = !!prevChunkBlob;
                    
                    addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Chờ chunk trước (${prevChunkIndex + 1}) quá lâu (${Math.round(MAX_WAIT_MS/1000)} giây). Trạng thái cuối: ${finalStatus}, Có blob: ${finalHasBlob ? 'Có' : 'Không'}. Tiếp tục nhưng có thể gặp lỗi.`, 'warning');
                    
                    // Nếu chunk trước vẫn pending sau 30 giây, đánh dấu failed để retry sau
                    if (prevChunkStatus !== 'failed' && prevChunkStatus !== 'success') {
                        if (!window.chunkStatus) window.chunkStatus = [];
                        window.chunkStatus[prevChunkIndex] = 'failed';
                        
                        if (!window.failedChunks) window.failedChunks = [];
                        if (!window.failedChunks.includes(prevChunkIndex)) {
                            window.failedChunks.push(prevChunkIndex);
                        }
                        
                        addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Đã đánh dấu chunk trước (${prevChunkIndex + 1}) là FAILED do timeout. Sẽ retry sau.`, 'warning');
                    }
                }
            }
        }
        
        // Kiểm tra xem có chunk nào đang được xử lý không
        if (window.sendingChunk !== null && window.sendingChunk !== ttuo$y_KhCV) {
            addLogEntry(`⏳ [Chunk ${ttuo$y_KhCV + 1}] Chunk ${window.sendingChunk + 1} đang được gửi. Đang chờ...`, 'info');
            
            // Chờ tối đa 30 giây
            const MAX_WAIT_SENDING_MS = 30000;
            const waitSendingStartTime = Date.now();
            let sendingCheckCount = 0;
            
            while (window.sendingChunk !== null && window.sendingChunk !== ttuo$y_KhCV && (Date.now() - waitSendingStartTime) < MAX_WAIT_SENDING_MS) {
                // KEEP-ALIVE: Phát Silent Audio trong vòng lặp chờ
                if (window.mmxKeepAliveRunning) {
                    playSilentAudio(false);
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                sendingCheckCount++;
                const elapsed = Date.now() - waitSendingStartTime;
                
                // Log tiến trình mỗi 5 giây
                if (sendingCheckCount % 10 === 0) {
                    addLogEntry(`⏳ [Chunk ${ttuo$y_KhCV + 1}] Vẫn đang chờ chunk ${window.sendingChunk + 1} hoàn tất... Đã chờ ${Math.round(elapsed/1000)}s`, 'info');
                }
            }
            
            if (window.sendingChunk !== null && window.sendingChunk !== ttuo$y_KhCV) {
                const elapsed = Date.now() - waitSendingStartTime;
                addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Chờ chunk ${window.sendingChunk + 1} đang gửi quá lâu (${Math.round(elapsed/1000)}s). Tiếp tục nhưng có thể gặp lỗi.`, 'warning');
            } else {
                const elapsed = Date.now() - waitSendingStartTime;
                addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Chunk đang gửi đã hoàn tất sau ${Math.round(elapsed/1000)}s. Tiếp tục...`, 'info');
            }
        }
        
        // Kiểm tra xem nút có bị disabled không (hệ thống đang xử lý)
        if (targetButton.disabled) {
            addLogEntry(`⏳ [Chunk ${ttuo$y_KhCV + 1}] Nút "${targetButton.textContent}" đang bị disabled (hệ thống đang xử lý). Đang chờ...`, 'info');
            
            // Chờ tối đa 30 giây cho nút sẵn sàng
            const MAX_WAIT_BUTTON_MS = 30000;
            const waitButtonStartTime = Date.now();
            let buttonCheckCount = 0;
            
            while (targetButton.disabled && (Date.now() - waitButtonStartTime) < MAX_WAIT_BUTTON_MS) {
                // KEEP-ALIVE: Phát Silent Audio trong vòng lặp chờ
                if (window.mmxKeepAliveRunning) {
                    playSilentAudio(false);
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                buttonCheckCount++;
                const elapsed = Date.now() - waitButtonStartTime;
                
                // Log tiến trình mỗi 5 giây
                if (buttonCheckCount % 10 === 0) {
                    addLogEntry(`⏳ [Chunk ${ttuo$y_KhCV + 1}] Vẫn đang chờ nút sẵn sàng... Đã chờ ${Math.round(elapsed/1000)}s`, 'info');
                }
                
                // Tìm lại nút (có thể đã thay đổi)
                const buttons = document.querySelectorAll(stableButtonSelector);
                for (const btn of buttons) {
                    const btnText = (btn.textContent || btn.innerText || '').toLowerCase().trim();
                    if (allButtonTexts.some(text => btnText.includes(text.toLowerCase())) && !btn.disabled) {
                        targetButton = btn;
                        break;
                    }
                }
            }
            
            if (targetButton.disabled) {
                throw new Error(`Nút "${targetButton.textContent}" vẫn bị disabled sau ${Math.round(MAX_WAIT_BUTTON_MS/1000)} giây. Không thể tiếp tục.`);
            } else {
                addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Nút đã sẵn sàng. Tiếp tục...`, 'info');
            }
        }
        
        // Thực hiện click
        KxTOuAJu(targetButton);

        // =======================================================
        // VÒNG XÁC MINH BỔ SUNG SAU KHI GỬI (CHỜ 3 GIÂY)
        // Nếu sau 3 giây độ dài trong textarea KHÁC với độ dài đã chuẩn hóa,
        // coi như Minimax đã chèn thêm văn bản → đánh dấu chunk thất bại
        // để hệ thống retry lại giống các chunk lỗi khác.
        // LƯU Ý: Khi USE_PAYLOAD_MODE bật, textarea đã được clear nên không cần kiểm tra này.
        // =======================================================
        try {
            // CHẾ ĐỘ MỚI: Bỏ qua kiểm tra độ dài khi USE_PAYLOAD_MODE bật
            if (window.USE_PAYLOAD_MODE) {
                // Log đã được ẩn để bảo mật
                // addLogEntry(`ℹ️ [Chunk ${ttuo$y_KhCV + 1}] PAYLOAD MODE: Bỏ qua kiểm tra độ dài textarea (textarea đã được clear, text thật đi qua payload)`, 'info');
            } else {
                // CHẾ ĐỘ CŨ: Vẫn kiểm tra độ dài như trước
            setTimeout(() => {
                try {
                    if (!window.expectedChunkLengths) return;
                    const expectedLen = window.expectedChunkLengths[ttuo$y_KhCV];
                    if (typeof expectedLen !== 'number') return;

                    const currentText = rUxbIRagbBVychZ$GfsogD[tQqGbytKzpHwhGmeQJucsrq(0x24c)] || '';
                    const actualLen = currentText.length;

                    if (actualLen !== expectedLen) {
                        addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Phát hiện văn bản bị thay đổi sau khi gửi (chuẩn hóa: ${expectedLen} ký tự, hiện tại: ${actualLen} ký tự). Đánh dấu chunk THẤT BẠI để retry.`, 'warning');

                        // Đánh dấu thất bại giống các nhánh lỗi khác
                        if (!window.chunkStatus) window.chunkStatus = [];
                        window.chunkStatus[ttuo$y_KhCV] = 'failed';

                        if (!window.failedChunks) window.failedChunks = [];
                        if (!window.failedChunks.includes(ttuo$y_KhCV)) {
                            window.failedChunks.push(ttuo$y_KhCV);
                        }

                        // Không giữ cờ sending cho chunk này nữa
                        if (window.sendingChunk === ttuo$y_KhCV) {
                            window.sendingChunk = null;
                        }
                    } else {
                        addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Xác minh độ dài sau khi gửi: KHỚP (${actualLen} ký tự)`, 'info');
                    }
                } catch (lengthCheckError) {
                    console.warn('Lỗi khi kiểm tra lại độ dài chunk sau 3 giây:', lengthCheckError);
                }
            }, 3000);
            }
        } catch (e) {
            console.warn('Không thể thiết lập vòng xác minh độ dài sau khi gửi chunk:', e);
        }
        
        // Cleanup: Dừng MutationObserver sau khi click
        setTimeout(() => {
            if (textObserver) {
                textObserver.disconnect();
                textObserver = null;
                addLogEntry(`🧹 [Chunk ${ttuo$y_KhCV + 1}] Đã dừng MutationObserver`, 'info');
            }
            
            // --- FIX BY GEMINI: KHÔNG ĐƯỢC XÓA INTERCEPT_TEXT Ở ĐÂY ---
            // Nếu mạng lag > 3s, việc xóa biến này sẽ khiến Interceptor không hoạt động
            // Biến window.INTERCEPT_CURRENT_TEXT sẽ được cập nhật tự động ở vòng lặp chunk tiếp theo.
            /*
            if (window.USE_PAYLOAD_MODE) {
                setTimeout(() => {
                   // ĐÃ TẮT CLEANUP ĐỂ BẢO VỆ CHUNK KHỎI BỊ GHI ĐÈ TEXT MẶC ĐỊNH KHI MẠNG LAG
                }, 2000);
            }
            */
        }, 1000);
        
        // Khởi tạo biến lưu timeout ID nếu chưa có
        if (typeof window.chunkTimeoutIds === 'undefined') window.chunkTimeoutIds = {};
        
        // QUAN TRỌNG: Clear TẤT CẢ timeout cũ (cả Srnj$swt và window.chunkTimeoutIds) trước khi set timeout mới
        if (Srnj$swt) {
            clearTimeout(Srnj$swt);
            Srnj$swt = null;
        }
        if (window.chunkTimeoutIds[ttuo$y_KhCV]) {
            clearTimeout(window.chunkTimeoutIds[ttuo$y_KhCV]);
            delete window.chunkTimeoutIds[ttuo$y_KhCV];
        }
        
        // Thiết lập timeout 35 giây cho chunk này
        addLogEntry(`⏱️ [Chunk ${ttuo$y_KhCV + 1}] Bắt đầu render - Timeout 35 giây`, 'info');
        
        // =======================================================
        // KIỂM TRA PAYLOAD SAU 3 GIÂY - PHÁT HIỆN THAY ĐỔI
        // =======================================================
        // Lưu text gốc của chunk để so sánh sau 3 giây
        const originalChunkText = chunkText;
        const originalChunkIndex = ttuo$y_KhCV;
        
        // Chờ 3 giây sau khi bắt đầu render để kiểm tra payload
        setTimeout(() => {
            try {
                // Kiểm tra xem chunk đã thành công chưa (nếu đã thành công thì không cần kiểm tra)
                if (window.chunkStatus && window.chunkStatus[originalChunkIndex] === 'success') {
                    return; // Chunk đã thành công, không cần kiểm tra
                }
                
                // Kiểm tra nếu INTERCEPT_CURRENT_TEXT đã bị thay đổi
                if (window.USE_PAYLOAD_MODE && window.INTERCEPT_CURRENT_TEXT) {
                    const currentInterceptText = window.INTERCEPT_CURRENT_TEXT;
                    const currentInterceptIndex = window.INTERCEPT_CURRENT_INDEX;
                    
                    // Kiểm tra nếu đây là chunk đang được xử lý và text đã bị thay đổi
                    if (currentInterceptIndex === originalChunkIndex) {
                        // So sánh text hiện tại với text gốc
                        if (currentInterceptText !== originalChunkText) {
                            addLogEntry(`🚨 [Chunk ${originalChunkIndex + 1}] PHÁT HIỆN: Payload đã bị thay đổi nội dung sau 3 giây!`, 'error');
                            addLogEntry(`⚠️ [Chunk ${originalChunkIndex + 1}] Text gốc: ${originalChunkText.length} ký tự, Text hiện tại: ${currentInterceptText.length} ký tự`, 'warning');
                            addLogEntry(`🔄 [Chunk ${originalChunkIndex + 1}] Đánh dấu thất bại và kích hoạt cơ chế retry (xáo dữ liệu rác)...`, 'warning');
                            
                            // Đánh dấu chunk này là thất bại
                            if (!window.chunkStatus) window.chunkStatus = [];
                            window.chunkStatus[originalChunkIndex] = 'failed';
                            if (!window.failedChunks) window.failedChunks = [];
                            if (!window.failedChunks.includes(originalChunkIndex)) {
                                window.failedChunks.push(originalChunkIndex);
                            }
                            
                            // Reset flag sendingChunk khi chunk thất bại
                            if (window.sendingChunk === originalChunkIndex) {
                                window.sendingChunk = null;
                            }
                            
                            // Dừng observer nếu đang chạy
                            if (xlgJHLP$MATDT$kTXWV) {
                                xlgJHLP$MATDT$kTXWV.disconnect();
                            }
                            
                            // QUAN TRỌNG: Đảm bảo vị trí này để trống (null) để sau này retry có thể lưu vào
                            if (typeof window.chunkBlobs === 'undefined') {
                                window.chunkBlobs = new Array(SI$acY.length).fill(null);
                            }
                            // Đảm bảo window.chunkBlobs có đủ độ dài
                            while (window.chunkBlobs.length <= originalChunkIndex) {
                                window.chunkBlobs.push(null);
                            }
                            window.chunkBlobs[originalChunkIndex] = null; // Đảm bảo vị trí này để trống
                            
                            // ĐỒNG BỘ HÓA ZTQj$LF$o: Đảm bảo ZTQj$LF$o cũng để trống
                            while (ZTQj$LF$o.length <= originalChunkIndex) {
                                ZTQj$LF$o.push(null);
                            }
                            ZTQj$LF$o[originalChunkIndex] = null; // Đảm bảo vị trí này để trống
                            
                            // Clear timeout của chunk này nếu đang chạy
                            if (window.chunkTimeoutIds && window.chunkTimeoutIds[originalChunkIndex]) {
                                clearTimeout(window.chunkTimeoutIds[originalChunkIndex]);
                                delete window.chunkTimeoutIds[originalChunkIndex];
                            }
                            
                            // CƠ CHẾ RETRY: Cleanup data rác và retry lại chunk này vô hạn
                            addLogEntry(`🔄 [Chunk ${originalChunkIndex + 1}] Payload bị thay đổi - Cleanup data rác và retry lại chunk này vô hạn cho đến khi thành công`, 'warning');
                            window.retryCount = 0; // Reset bộ đếm retry
                            
                            // Cleanup data rác và reset trước khi retry
                            (async () => {
                                await cleanupChunkData(originalChunkIndex); // Cleanup data rác trước
                                await resetWebInterface(); // Reset web interface
                                // KHÔNG tăng ttuo$y_KhCV, giữ nguyên để retry lại chunk này
                                setTimeout(uSTZrHUt_IC, getRandomChunkDelay()); // Retry sau delay 1-3 giây
                            })();
                        } else {
                            addLogEntry(`✅ [Chunk ${originalChunkIndex + 1}] Kiểm tra ...`, 'info');
                        }
                    }
                } else if (window.USE_PAYLOAD_MODE && !window.INTERCEPT_CURRENT_TEXT) {
                    // Nếu USE_PAYLOAD_MODE bật nhưng INTERCEPT_CURRENT_TEXT đã bị clear (có thể đã được gửi)
                    addLogEntry(`ℹ️ [Chunk ${originalChunkIndex + 1}] Kiểm tra`, 'info');
                }
            } catch (payloadCheckError) {
                console.warn(`Lỗi khi kiểm tra payload sau 3 giây cho chunk ${originalChunkIndex + 1}:`, payloadCheckError);
                addLogEntry(`⚠️ [Chunk ${originalChunkIndex + 1}] Lỗi khi kiểm tra payload: ${payloadCheckError.message}`, 'warning');
            }
        }, 3000); // Chờ 3 giây sau khi bắt đầu render
        
        window.chunkTimeoutIds[ttuo$y_KhCV] = setTimeout(async () => {
            // QUAN TRỌNG: Kiểm tra xem chunk đã thành công chưa trước khi trigger timeout
            if (window.chunkStatus && window.chunkStatus[ttuo$y_KhCV] === 'success') {
                return; // Chunk đã thành công, không cần xử lý
            }
            
            addLogEntry(`⏱️ [Chunk ${ttuo$y_KhCV + 1}] Timeout sau 35 giây - không có kết quả!`, 'error');
            addLogEntry(`🔄 Kích hoạt cơ chế reset và đánh dấu thất bại...`, 'warning');
            
            // Dừng observer nếu đang chạy
            if (xlgJHLP$MATDT$kTXWV) {
                xlgJHLP$MATDT$kTXWV.disconnect();
            }
            
            // Đánh dấu chunk này là thất bại
            if (!window.chunkStatus) window.chunkStatus = [];
            window.chunkStatus[ttuo$y_KhCV] = 'failed';
            if (!window.failedChunks) window.failedChunks = [];
            if (!window.failedChunks.includes(ttuo$y_KhCV)) {
                window.failedChunks.push(ttuo$y_KhCV);
            }
            
            // QUAN TRỌNG: Đảm bảo vị trí này để trống (null) để sau này retry có thể lưu vào
            if (typeof window.chunkBlobs === 'undefined') {
                window.chunkBlobs = new Array(SI$acY.length).fill(null);
            }
            // Đảm bảo window.chunkBlobs có đủ độ dài
            while (window.chunkBlobs.length <= ttuo$y_KhCV) {
                window.chunkBlobs.push(null);
            }
            window.chunkBlobs[ttuo$y_KhCV] = null; // Đảm bảo vị trí này để trống
            
            // ĐỒNG BỘ HÓA ZTQj$LF$o: Đảm bảo ZTQj$LF$o cũng để trống
            while (ZTQj$LF$o.length <= ttuo$y_KhCV) {
                ZTQj$LF$o.push(null);
            }
            ZTQj$LF$o[ttuo$y_KhCV] = null; // Đảm bảo vị trí này để trống
            
            addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Đã đánh dấu thất bại và để trống vị trí ${ttuo$y_KhCV} để retry sau`, 'info');
            
            // Reset flag sendingChunk khi chunk thất bại
            if (window.sendingChunk === ttuo$y_KhCV) {
                window.sendingChunk = null;
            }
            
            // Reset web interface - CHỈ reset khi 1 chunk cụ thể render lỗi
            await resetWebInterface();
            
            addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Đã timeout sau 35 giây.`, 'warning');
            
            // CƠ CHẾ RETRY MỚI: Cleanup data rác và retry lại chunk này vô hạn
            addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Timeout - Cleanup data rác và retry lại chunk này vô hạn cho đến khi thành công`, 'warning');
            window.retryCount = 0; // Reset bộ đếm retry
            
            // Cleanup data rác và reset trước khi retry
            (async () => {
                await cleanupChunkData(ttuo$y_KhCV); // Cleanup data rác trước
                await resetWebInterface(); // Reset web interface
                // KHÔNG tăng ttuo$y_KhCV, giữ nguyên để retry lại chunk này
                setTimeout(uSTZrHUt_IC, getRandomChunkDelay()); // Retry sau delay 1-3 giây
            })();
        }, 35000); // Timeout 35 giây cho mỗi chunk
        
        // QUAN TRỌNG: Gọi igyo$uwVChUzI() để tạo MutationObserver detect audio element
        // Hàm này chỉ tạo MutationObserver, không tạo timeout (timeout đã được tạo ở trên)
        igyo$uwVChUzI();

    } catch (error) {
        // ANTI-DETECTION: Kiểm tra lỗi 403 trước
        if (error.message && error.message.includes('403')) {
            addLogEntry(`🚨 [Chunk ${ttuo$y_KhCV + 1}] Lỗi 403: Website đã phát hiện automation!`, 'error');
            addLogEntry(`💡 Giải pháp: Đóng trình duyệt, mở lại và thử profile khác (không có Gmail)`, 'warning');
            
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '🚨 Website đã phát hiện automation!',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Lỗi 403:</strong> Website Minimax.io đã chặn tool automation.</p>
                            <hr>
                            <p><strong>💡 Giải pháp:</strong></p>
                            <ol>
                                <li>Đóng trình duyệt và mở lại</li>
                                <li>Sử dụng profile Chrome khác (không đăng nhập Gmail)</li>
                                <li>Đợi 10-15 phút rồi thử lại</li>
                                <li>Thử trên trình duyệt khác (Edge, Firefox)</li>
                            </ol>
                            <hr>
                            <p><strong>⚠️ Lưu ý:</strong> Không nên đăng nhập Gmail trong profile đang dùng tool!</p>
                        </div>
                    `,
                    icon: 'warning',
                    width: '600px',
                    confirmButtonText: 'Hiểu rồi',
                    confirmButtonColor: '#ff6b6b'
                });
            }
            return; // Dừng xử lý chunk này
        }
        
        // CƠ CHẾ RETRY MỚI: Cleanup data rác và retry lại chunk này vô hạn, không giới hạn số lần
        addLogEntry(`🔄 [Chunk ${ttuo$y_KhCV + 1}] Render lỗi - Cleanup data rác và retry lại chunk này vô hạn cho đến khi thành công`, 'warning');
            
            // Reset flag sendingChunk để cho phép retry
            window.sendingChunk = null;

        // QUAN TRỌNG: Cleanup data rác trước, sau đó reset web interface
            try {
            await cleanupChunkData(ttuo$y_KhCV); // Cleanup data rác của chunk này trước
            await resetWebInterface(); // Reset web interface
            addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] Đã cleanup data rác và reset web thành công!`, 'success');
            } catch (resetError) {
                addLogEntry(`❌ Lỗi khi reset web: ${resetError.message}`, 'error');
                // Vẫn tiếp tục retry ngay cả khi reset lỗi, nhưng cần cleanup audio thủ công
                try {
                    // Cleanup audio thủ công nếu resetWebInterface() lỗi
                    const audioElements = document.querySelectorAll('audio');
                    let stoppedCount = 0;
                    audioElements.forEach(audio => {
                        try {
                            if (!audio.paused) {
                                audio.pause();
                                audio.currentTime = 0;
                                stoppedCount++;
                            }
                            if (audio.src) {
                                audio.src = '';
                            }
                        } catch (e) {
                            // Bỏ qua lỗi từng audio element
                        }
                    });
                    
                    const sourceElements = document.querySelectorAll('source');
                    sourceElements.forEach(source => {
                        try {
                            if (source.src) {
                                source.src = '';
                            }
                        } catch (e) {
                            // Bỏ qua lỗi
                        }
                    });
                    
                    if (window.audioContext) {
                        try {
                            if (window.audioContext.state !== 'closed') {
                                window.audioContext.close();
                            }
                            window.audioContext = null;
                        } catch (e) {
                            // Bỏ qua
                        }
                    }
                    
                    if (window.AudioContext || window.webkitAudioContext) {
                        Object.keys(window).forEach(key => {
                            try {
                                const value = window[key];
                                if (value && typeof value === 'object' && typeof value.close === 'function' && typeof value.state === 'string') {
                                    if (value.state !== 'closed') {
                                        value.close();
                                    }
                                    window[key] = null;
                                }
                            } catch (e) {
                                // Bỏ qua
                            }
                        });
                    }
                    
                    if (stoppedCount > 0) {
                        addLogEntry(`🧹 Đã dừng ${stoppedCount} audio element(s) và clear audio context (fallback)`, 'info');
                    }
                } catch (audioError) {
                    addLogEntry(`⚠️ Lỗi khi cleanup audio thủ công: ${audioError.message}`, 'warning');
                }
            }

        // KHÔNG tăng ttuo$y_KhCV, giữ nguyên để retry lại chunk này vô hạn
        // Retry sau delay ngắn
        setTimeout(uSTZrHUt_IC, getRandomChunkDelay()); // Delay 1-3 giây rồi retry lại
    }
}


function igyo$uwVChUzI() {
    const VFmk$UVEL = AP$u_huhInYfTj;
    
    // RATE LIMITING: Chỉ cho phép gọi tối đa 1 lần/2 giây
    const now = Date.now();
    if (typeof window.lastObserverSetupTime === 'undefined') {
        window.lastObserverSetupTime = 0;
    }
    if (now - window.lastObserverSetupTime < 2000) {
        const waitTime = 2000 - (now - window.lastObserverSetupTime);
        addLogEntry(`⏳ [Chunk ${ttuo$y_KhCV + 1}] Rate limiting: Chờ ${waitTime}ms trước khi thiết lập observer...`, 'info');
        setTimeout(igyo$uwVChUzI, waitTime);
        return;
    }
    
    // FLAG: Tránh tạo nhiều observer cùng lúc
    if (typeof window.isSettingUpObserver === 'undefined') {
        window.isSettingUpObserver = false;
    }
    if (window.isSettingUpObserver) {
        addLogEntry(`⚠️ [Chunk ${ttuo$y_KhCV + 1}] Đang thiết lập observer, bỏ qua lần gọi trùng lặp này`, 'warning');
        return;
    }
    
    const Yy_yaGQ$LW = document[VFmk$UVEL(0x1cd)](VFmk$UVEL(0x256));
    if (!Yy_yaGQ$LW) {
        addLogEntry(`⚠️ Không tìm thấy element để observe audio, thử lại sau 1 giây...`, 'warning');
        setTimeout(igyo$uwVChUzI, 1000); // Retry sau 1 giây (vô hạn như yêu cầu)
        return;
    }

    // Đánh dấu đang thiết lập observer
    window.isSettingUpObserver = true;
    window.lastObserverSetupTime = now;

    // QUAN TRỌNG: Disconnect observer cũ nếu có để tránh duplicate
    if (xlgJHLP$MATDT$kTXWV) {
        xlgJHLP$MATDT$kTXWV.disconnect();
        xlgJHLP$MATDT$kTXWV = null;
    }
    
    addLogEntry(`👁️ [Chunk ${ttuo$y_KhCV + 1}] Đang thiết lập ...`, 'info');

    // DEBOUNCE: Khởi tạo timestamp cho callback
    if (typeof window.observerCallbackLastRun === 'undefined') {
        window.observerCallbackLastRun = 0;
    }
    
    xlgJHLP$MATDT$kTXWV = new MutationObserver(async (w$KFkMtMom_agF, GrmINfCyEsyqJbigpyT) => {
        const ndkpgKnjg = VFmk$UVEL;
        
        // DEBOUNCE: Chỉ cho phép callback chạy tối đa 1 lần/giây
        const callbackNow = Date.now();
        if (callbackNow - window.observerCallbackLastRun < 1000) {
            return; // Bỏ qua nếu chưa đủ 1 giây
        }
        window.observerCallbackLastRun = callbackNow;
        
        for (const qcgcrPbku_NfOSGWmbTlMZNUOu of w$KFkMtMom_agF) {
            for (const TYRNWSSd$QOYZe of qcgcrPbku_NfOSGWmbTlMZNUOu[ndkpgKnjg(0x1db)]) {
                if (TYRNWSSd$QOYZe[ndkpgKnjg(0x217)] === 0x7fd * parseInt(-0x3) + 0xa02 + 0xdf6 && TYRNWSSd$QOYZe[ndkpgKnjg(0x1cd)](ndkpgKnjg(0x1f2))) {
                    // QUAN TRỌNG: Lưu currentChunkIndex ngay đầu để tránh race condition
                    const currentChunkIndex = ttuo$y_KhCV;
                    
                    // QUAN TRỌNG: Ngăn chặn xử lý trùng lặp cho cùng một chunk
                    if (typeof window.processingChunks === 'undefined') {
                        window.processingChunks = new Set();
                    }
                    // Kiểm tra xem chunk này đã được xử lý chưa
                    if (window.processingChunks.has(currentChunkIndex)) {
                        addLogEntry(`⚠️ [Chunk ${currentChunkIndex + 1}] Đang được xử lý, bỏ qua audio element trùng lặp này`, 'warning');
                        return;
                    }
                    // Kiểm tra xem chunk này đã thành công chưa
                    if (window.chunkStatus && window.chunkStatus[currentChunkIndex] === 'success') {
                        addLogEntry(`⚠️ [Chunk ${currentChunkIndex + 1}] Đã được xử lý thành công trước đó, bỏ qua`, 'warning');
                        return;
                    }
                    // QUAN TRỌNG: Kiểm tra xem chunk này có đang được xử lý không (pending hoặc failed)
                    // CƠ CHẾ RETRY MỚI: Cho phép retry chunk failed trong mọi trường hợp (không cần isFinalCheck)
                    if (window.chunkStatus && window.chunkStatus[currentChunkIndex]) {
                        const status = window.chunkStatus[currentChunkIndex];
                        // Cho phép xử lý nếu: pending (bình thường) hoặc failed (retry vô hạn)
                        if (status === 'pending') {
                            // OK, chunk đang pending
                        } else if (status === 'failed') {
                            // OK, chunk failed - cho phép retry vô hạn (cơ chế retry mới)
                            addLogEntry(`🔄 [Chunk ${currentChunkIndex + 1}] Đang retry chunk failed (retry vô hạn)...`, 'info');
                        } else if (status === 'success') {
                            // Chunk đã thành công, không cần xử lý lại
                            addLogEntry(`✅ [Chunk ${currentChunkIndex + 1}] Đã thành công, bỏ qua`, 'info');
                            return;
                        } else {
                            // Trạng thái khác (không rõ), vẫn cho phép xử lý để tránh bỏ sót
                            addLogEntry(`⚠️ [Chunk ${currentChunkIndex + 1}] Trạng thái không rõ (${status}), vẫn tiếp tục xử lý...`, 'warning');
                        }
                    }
                    
                    // Đánh dấu chunk này đang được xử lý
                    window.processingChunks.add(currentChunkIndex);
                    
                    clearTimeout(Srnj$swt);
                    // KHÔNG disconnect observer ở đây - sẽ disconnect sau khi xử lý xong

                    // QUAN TRỌNG: KHÔNG đánh dấu success ở đây
                    // Chỉ đánh dấu success SAU KHI kiểm tra dung lượng hợp lệ và đã lưu blob
                    
                    // Clear timeout 35 giây cho chunk này (clear ngay khi detect audio để tránh timeout)
                    if (typeof window.chunkTimeoutIds !== 'undefined' && window.chunkTimeoutIds[currentChunkIndex]) {
                        clearTimeout(window.chunkTimeoutIds[currentChunkIndex]);
                        delete window.chunkTimeoutIds[currentChunkIndex];
                        addLogEntry(`⏱️ [Chunk ${currentChunkIndex + 1}] Đã clear timeout 35 giây`, 'info');
                    }
                    // Clear timeout từ igyo$uwVChUzI() nếu có
                    if (Srnj$swt) {
                        clearTimeout(Srnj$swt);
                        Srnj$swt = null;
                    }
                    
                    // Reset flag sendingChunk (reset ngay khi detect audio)
                    if (window.sendingChunk === currentChunkIndex) {
                        window.sendingChunk = null;
                    }

                    // ĐỒNG BỘ HÓA KHI RETRY: Đảm bảo window.chunkBlobs được cập nhật khi retry thành công
                    if (typeof window.chunkBlobs === 'undefined') {
                        window.chunkBlobs = new Array(SI$acY.length).fill(null);
                    }
                    // Chunk này sẽ được lưu vào window.chunkBlobs ở phần code phía dưới

                    const yEExghI = TYRNWSSd$QOYZe[ndkpgKnjg(0x1cd)](ndkpgKnjg(0x1f2))[ndkpgKnjg(0x1f1)];
                    if (yEExghI && (yEExghI[ndkpgKnjg(0x20e)](ndkpgKnjg(0x1fa)) || yEExghI[ndkpgKnjg(0x20e)](ndkpgKnjg(0x26f)))) try {
                        // ANTI-DETECTION: Thêm delay ngẫu nhiên và headers để tránh bị phát hiện
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
                        
                        const FGrxK_RK = await fetch(yEExghI, {
                            method: 'GET',
                            headers: {
                                'Accept': 'audio/mpeg, audio/*, */*',
                                'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                                'Sec-Fetch-Dest': 'audio',
                                'Sec-Fetch-Mode': 'cors',
                                'Sec-Fetch-Site': 'same-origin',
                                'User-Agent': navigator.userAgent,
                                'Referer': window.location.href
                            },
                            credentials: 'same-origin',
                            mode: 'cors'
                        });
                        
                        if (!FGrxK_RK['ok']) {
                            if (FGrxK_RK.status === 403) {
                                addLogEntry(`❌ [Chunk ${currentChunkIndex + 1}] Lỗi 403: Website đã phát hiện automation. Thử lại sau 5 giây...`, 'error');
                                await new Promise(resolve => setTimeout(resolve, 5000));
                                throw new Error('403 Forbidden - Website detected automation');
                            }
                            throw new Error(ndkpgKnjg(0x241) + FGrxK_RK[ndkpgKnjg(0x237)]);
                        }
                        const qILAV = await FGrxK_RK[ndkpgKnjg(0x26f)]();
                        
                        // Kiểm tra blob có tồn tại không
                        if (!qILAV) {
                            addLogEntry(`❌ [Chunk ${currentChunkIndex + 1}] Blob không tồn tại - không hợp lệ!`, 'error');
                            addLogEntry(`🔄 Kích hoạt cơ chế reset và đánh dấu thất bại (giống như timeout)...`, 'warning');
                            
                            // Hủy bỏ đánh dấu success (đã đánh dấu ở trên)
                            if (window.chunkStatus) {
                                window.chunkStatus[currentChunkIndex] = 'failed';
                            }
                            
                            // Thêm vào danh sách failedChunks
                            if (!window.failedChunks) window.failedChunks = [];
                            if (!window.failedChunks.includes(currentChunkIndex)) {
                                window.failedChunks.push(currentChunkIndex);
                            }
                            
                            // QUAN TRỌNG: Đảm bảo vị trí này để trống (null) để sau này retry có thể lưu vào
                            if (typeof window.chunkBlobs === 'undefined') {
                                window.chunkBlobs = new Array(SI$acY.length).fill(null);
                            }
                            // Đảm bảo window.chunkBlobs có đủ độ dài
                            while (window.chunkBlobs.length <= currentChunkIndex) {
                                window.chunkBlobs.push(null);
                            }
                            window.chunkBlobs[currentChunkIndex] = null; // Đảm bảo vị trí này để trống
                            
                            // ĐỒNG BỘ HÓA ZTQj$LF$o: Đảm bảo ZTQj$LF$o cũng để trống
                            while (ZTQj$LF$o.length <= currentChunkIndex) {
                                ZTQj$LF$o.push(null);
                            }
                            ZTQj$LF$o[currentChunkIndex] = null; // Đảm bảo vị trí này để trống
                            
                            addLogEntry(`🔄 [Chunk ${currentChunkIndex + 1}] Đã đánh dấu thất bại và để trống vị trí ${currentChunkIndex} để retry sau`, 'info');
                            
                            // Xóa khỏi processingChunks
                            if (typeof window.processingChunks !== 'undefined') {
                                window.processingChunks.delete(currentChunkIndex);
                            }
                            
                            // Reset flag sendingChunk khi chunk thất bại
                            if (window.sendingChunk === currentChunkIndex) {
                                window.sendingChunk = null;
                            }
                            
                            // Dừng observer nếu đang chạy
                            if (xlgJHLP$MATDT$kTXWV) {
                                xlgJHLP$MATDT$kTXWV.disconnect();
                                xlgJHLP$MATDT$kTXWV = null;
                            }
                            // Reset flag để cho phép thiết lập observer mới
                            window.isSettingUpObserver = false;
                            
                            // Clear timeout 35 giây cho chunk này
                            if (typeof window.chunkTimeoutIds !== 'undefined' && window.chunkTimeoutIds[currentChunkIndex]) {
                                clearTimeout(window.chunkTimeoutIds[currentChunkIndex]);
                                delete window.chunkTimeoutIds[currentChunkIndex];
                            }
                            
                            // Cleanup data rác và reset web interface trước khi retry
                            await cleanupChunkData(currentChunkIndex); // Cleanup data rác trước
                            await resetWebInterface(); // Reset web interface
                            
                            // CƠ CHẾ RETRY MỚI: Retry lại chunk này vô hạn, không chuyển sang chunk tiếp theo
                            addLogEntry(`🔄 [Chunk ${currentChunkIndex + 1}] Blob null - Đã cleanup và reset, retry lại chunk này vô hạn cho đến khi thành công`, 'warning');
                                // Giữ nguyên ttuo$y_KhCV = currentChunkIndex để retry lại
                                ttuo$y_KhCV = currentChunkIndex;
                            setTimeout(uSTZrHUt_IC, getRandomChunkDelay()); // Retry sau delay 1-3 giây
                            return; // Dừng xử lý, không lưu blob
                        }

                        // Luôn kiểm tra dung lượng cho mọi blob
                        const chunkSizeKB = qILAV.size / 1024;
                        
                        // =======================================================
                        // == KIỂM TRA: Khoảng dung lượng không hợp lệ (39.01 - 39.80 KB) ==
                        // == Lưu ý: 39.84 KB và các giá trị >= 39.85 KB được coi là hợp lệ ==
                        // =======================================================
                        const MIN_SIZE_KB = 39.01;
                        const MAX_SIZE_KB = 39.80; // Giảm từ 40.0 xuống 39.80 để chấp nhận 39.84 KB
                        const isInSuspiciousRange = chunkSizeKB >= MIN_SIZE_KB && chunkSizeKB <= MAX_SIZE_KB;
                        
                        if (isInSuspiciousRange) {
                            addLogEntry(`❌ [Chunk ${currentChunkIndex + 1}] Dung lượng blob = ${chunkSizeKB.toFixed(2)} KB nằm trong khoảng không hợp lệ (${MIN_SIZE_KB} - ${MAX_SIZE_KB} KB) - Không hợp lệ!`, 'error');
                            addLogEntry(`🔄 Kích hoạt cơ chế reset và đánh dấu thất bại...`, 'warning');
                            
                            // Hủy bỏ đánh dấu success (nếu có)
                            if (window.chunkStatus) {
                                window.chunkStatus[currentChunkIndex] = 'failed';
                            }
                            
                            // Thêm vào danh sách failedChunks
                            if (!window.failedChunks) window.failedChunks = [];
                            if (!window.failedChunks.includes(currentChunkIndex)) {
                                window.failedChunks.push(currentChunkIndex);
                            }
                            
                            // QUAN TRỌNG: Đảm bảo vị trí này để trống (null) để sau này retry có thể lưu vào
                            if (typeof window.chunkBlobs === 'undefined') {
                                window.chunkBlobs = new Array(SI$acY.length).fill(null);
                            }
                            // Đảm bảo window.chunkBlobs có đủ độ dài
                            while (window.chunkBlobs.length <= currentChunkIndex) {
                                window.chunkBlobs.push(null);
                            }
                            window.chunkBlobs[currentChunkIndex] = null; // Đảm bảo vị trí này để trống
                            
                            // ĐỒNG BỘ HÓA ZTQj$LF$o: Đảm bảo ZTQj$LF$o cũng để trống
                            while (ZTQj$LF$o.length <= currentChunkIndex) {
                                ZTQj$LF$o.push(null);
                            }
                            ZTQj$LF$o[currentChunkIndex] = null; // Đảm bảo vị trí này để trống
                            
                            addLogEntry(`🔄 [Chunk ${currentChunkIndex + 1}] Đã đánh dấu thất bại và để trống vị trí ${currentChunkIndex} để retry sau`, 'info');
                            
                            // Xóa khỏi processingChunks
                            if (typeof window.processingChunks !== 'undefined') {
                                window.processingChunks.delete(currentChunkIndex);
                            }
                            
                            // Reset flag sendingChunk khi chunk thất bại
                            if (window.sendingChunk === currentChunkIndex) {
                                window.sendingChunk = null;
                            }
                            
                            // Dừng observer nếu đang chạy
                            if (xlgJHLP$MATDT$kTXWV) {
                                xlgJHLP$MATDT$kTXWV.disconnect();
                                xlgJHLP$MATDT$kTXWV = null;
                            }
                            // Reset flag để cho phép thiết lập observer mới
                            window.isSettingUpObserver = false;
                            
                            // Clear timeout 35 giây cho chunk này
                            if (typeof window.chunkTimeoutIds !== 'undefined' && window.chunkTimeoutIds[currentChunkIndex]) {
                                clearTimeout(window.chunkTimeoutIds[currentChunkIndex]);
                                delete window.chunkTimeoutIds[currentChunkIndex];
                            }
                            
                            // Cleanup data rác và reset web interface trước khi retry
                            await cleanupChunkData(currentChunkIndex); // Cleanup data rác trước
                            await resetWebInterface(); // Reset web interface
                            
                            // CƠ CHẾ RETRY MỚI: Reset và retry lại chunk này vô hạn, không chuyển sang chunk tiếp theo
                            addLogEntry(`🔄 [Chunk ${currentChunkIndex + 1}] Dung lượng trong khoảng không hợp lệ (${MIN_SIZE_KB} - ${MAX_SIZE_KB} KB) - Đã cleanup và reset, retry lại chunk này vô hạn cho đến khi thành công`, 'warning');
                            // Giữ nguyên ttuo$y_KhCV = currentChunkIndex để retry lại
                            ttuo$y_KhCV = currentChunkIndex;
                            setTimeout(uSTZrHUt_IC, getRandomChunkDelay()); // Retry sau delay 1-3 giây
                            return; // Dừng xử lý, không lưu blob
                        }

                        addLogEntry(`🔍 [Chunk ${currentChunkIndex + 1}] Dung lượng blob ...`, 'info');

                        // =======================================================
                        // == END: KIỂM TRA DUNG LƯỢNG BLOB ==
                        // =======================================================
                        
                        // Log xác nhận kiểm tra dung lượng đã chạy và blob hợp lệ
                        addLogEntry(`✅ [Chunk ${currentChunkIndex + 1}] Đã kiểm tra dung lượng ...`, 'info');
                        
                        
                        // Lưu chunk vào đúng vị trí dựa trên currentChunkIndex (đã lưu ở đầu callback)
                        if (typeof window.chunkBlobs === 'undefined') {
                            window.chunkBlobs = new Array(SI$acY.length).fill(null);
                        }

                        // Đảm bảo window.chunkBlobs có đủ độ dài
                        while (window.chunkBlobs.length <= currentChunkIndex) {
                            window.chunkBlobs.push(null);
                        }
                        
                        // QUAN TRỌNG: Kiểm tra xem vị trí này đã có chunk chưa
                        // Nếu đã có chunk và chunk đó đã thành công, không ghi đè (có thể là chunk khác)
                        if (window.chunkBlobs[currentChunkIndex] !== null) {
                            // Kiểm tra xem chunk ở vị trí này có phải là chunk hiện tại không
                            if (window.chunkStatus && window.chunkStatus[currentChunkIndex] === 'success') {
                                addLogEntry(`⚠️ [Chunk ${currentChunkIndex + 1}] Vị trí ${currentChunkIndex} đã có chunk thành công, không ghi đè`, 'warning');
                                // Xóa khỏi processingChunks và return
                                if (typeof window.processingChunks !== 'undefined') {
                                    window.processingChunks.delete(currentChunkIndex);
                                }
                                return;
                            }
                            // Nếu vị trí này có chunk nhưng chunk đó failed, có thể ghi đè (retry)
                            if (window.chunkStatus && window.chunkStatus[currentChunkIndex] === 'failed') {
                                addLogEntry(`🔄 [Chunk ${currentChunkIndex + 1}] Vị trí ${currentChunkIndex} có chunk failed, ghi đè (retry)`, 'info');
                            }
                        }
                        
                        // Lưu chunk vào đúng vị trí
                        window.chunkBlobs[currentChunkIndex] = qILAV;

                        // ĐỒNG BỘ HÓA ZTQj$LF$o: Đảm bảo ZTQj$LF$o cũng có chunk ở đúng vị trí
                        // Nếu ZTQj$LF$o chưa đủ độ dài, mở rộng mảng
                        while (ZTQj$LF$o.length <= currentChunkIndex) {
                            ZTQj$LF$o.push(null);
                        }
                        ZTQj$LF$o[currentChunkIndex] = qILAV;

                        // ĐỒNG BỘ HÓA: Đảm bảo cả hai mảng đều có chunk này ở đúng vị trí
                        addLogEntry(`🔄 Đã lưu chunk ${currentChunkIndex + 1} vào vị trí ${currentChunkIndex} của cả window.chunkBlobs và ZTQj$LF$o`, 'info');

                        // DEBUG: Kiểm tra trạng thái mảng sau khi lưu
                        const chunkStatus = window.chunkBlobs.map((blob, idx) => blob ? 'có' : 'null').join(', ');
                        addLogEntry(`🔍 Trạng thái window.chunkBlobs: [${chunkStatus}]`, 'info');
                        
                        // Xóa khỏi processingChunks sau khi lưu thành công
                        if (typeof window.processingChunks !== 'undefined') {
                            window.processingChunks.delete(currentChunkIndex);
                        }
                        
                        // =======================================================
                        // == ĐÁNH DẤU THÀNH CÔNG: SAU KHI TẤT CẢ KIỂM TRA ĐỀU HỢP LỆ ==
                        // =======================================================
                        // QUAN TRỌNG: Chỉ đánh dấu success SAU KHI đã kiểm tra dung lượng và lưu blob thành công
                        window.chunkStatus[currentChunkIndex] = 'success';
                        window.retryCount = 0; // Reset bộ đếm retry khi thành công
                        // Reset timeout retry count cho chunk này khi thành công
                        if (typeof window.timeoutRetryCount !== 'undefined' && window.timeoutRetryCount[currentChunkIndex] !== undefined) {
                            window.timeoutRetryCount[currentChunkIndex] = 0;
                        }
                        
                        // Log khi thành công
                        addLogEntry(`✅ [Chunk ${currentChunkIndex + 1}/${SI$acY.length}] Xử lý thành công!`, 'success');
                        
                        // Reset flag chunk1Failed nếu chunk 1 thành công
                        if (currentChunkIndex === 0) {
                            window.chunk1Failed = false;
                            addLogEntry(`✅ [Chunk 1] Đã thành công - Reset flag kiểm tra cấu hình`, 'success');
                        }

                        // Xóa khỏi failedChunks nếu có
                        if (window.failedChunks && window.failedChunks.includes(currentChunkIndex)) {
                            window.failedChunks = window.failedChunks.filter(index => index !== currentChunkIndex);
                            addLogEntry(`🎉 [Chunk ${currentChunkIndex + 1}] Đã khôi phục thành công từ trạng thái thất bại!`, 'success');
                        }
                        // =======================================================
                        // == END: ĐÁNH DẤU THÀNH CÔNG ==
                        // =======================================================
                        
                        // DISCONNECT OBSERVER SAU KHI XỬ LÝ XONG (không disconnect trong callback)
                        if (xlgJHLP$MATDT$kTXWV) {
                            xlgJHLP$MATDT$kTXWV.disconnect();
                            xlgJHLP$MATDT$kTXWV = null;
                        }
                        // Reset flag để cho phép thiết lập observer mới
                        window.isSettingUpObserver = false;
                    } catch (FBleqcOZcLNC$NKSlfC) {
                        // Xóa khỏi processingChunks khi có lỗi
                        if (typeof window.processingChunks !== 'undefined' && typeof currentChunkIndex !== 'undefined') {
                            window.processingChunks.delete(currentChunkIndex);
                        }
                        // Reset flag khi có lỗi
                        window.isSettingUpObserver = false;
                    }
                    
                    // CƠ CHẾ RETRY MỚI: Sau khi chunk thành công, chuyển sang chunk tiếp theo
                    // Xóa khỏi failedChunks nếu có
                    if (window.failedChunks && window.failedChunks.includes(currentChunkIndex)) {
                            window.failedChunks = window.failedChunks.filter(idx => idx !== currentChunkIndex);
                        }
                        
                    // Chuyển sang chunk tiếp theo
                    ttuo$y_KhCV++;
                    if (ttuo$y_KhCV >= SI$acY.length) {
                        // Đã xử lý xong tất cả chunks
                        addLogEntry(`✅ Đã xử lý xong tất cả chunks!`, 'success');
                            ttuo$y_KhCV = SI$acY.length; // Đánh dấu hoàn thành
                    }
                    
                    // GUARD: Kiểm tra độ sâu recursive calls
                    if (typeof window.recursiveCallDepth === 'undefined') {
                        window.recursiveCallDepth = 0;
                    }
                    if (typeof window.maxRecursiveDepth === 'undefined') {
                        window.maxRecursiveDepth = 50;
                    }
                    
                    window.recursiveCallDepth++;
                    if (window.recursiveCallDepth > window.maxRecursiveDepth) {
                        addLogEntry(`⚠️ Đã đạt độ sâu recursive tối đa (${window.maxRecursiveDepth}), reset và tiếp tục...`, 'warning');
                        window.recursiveCallDepth = 0;
                        // Chờ một chút trước khi tiếp tục
                        setTimeout(() => {
                            window.recursiveCallDepth = 0;
                            uSTZrHUt_IC();
                        }, getRandomChunkDelay());
                        return;
                    }
                    
                    // Sau khi xử lý xong chunk hiện tại, luôn đợi ngẫu nhiên 1–3 giây rồi mới xử lý chunk tiếp theo
                    setTimeout(() => {
                        window.recursiveCallDepth = Math.max(0, window.recursiveCallDepth - 1); // Giảm độ sâu sau mỗi lần gọi
                        uSTZrHUt_IC();
                    }, getRandomChunkDelay());
                    return;
                }
            }
        }
    });

    xlgJHLP$MATDT$kTXWV[VFmk$UVEL(0x264)](Yy_yaGQ$LW, {
        'childList': !![],
        'subtree': !![]
    });
    
    // Reset flag sau khi thiết lập xong (sau một chút để đảm bảo observer đã hoạt động)
    setTimeout(() => {
        window.isSettingUpObserver = false;
    }, 100);
    
    addLogEntry(`✅ [Chunk ${ttuo$y_KhCV + 1}] MutationObserver...`, 'success');
}function rBuqJlBFmwzdZnXtjIL(){const fgUnHA=AP$u_huhInYfTj,ytkOLYJZOEaDOhowaP=document[fgUnHA(0x1cd)](fgUnHA(0x246));ytkOLYJZOEaDOhowaP&&ytkOLYJZOEaDOhowaP[fgUnHA(0x224)](fgUnHA(0x1bc))===fgUnHA(0x1fe)&&KxTOuAJu(ytkOLYJZOEaDOhowaP);}function ZGEvDUSUwgCtRqI(XOH_jolXfrzfb$u){return new Promise(f$o$ehE=>{const XfxSTlMrygLQP$ENoXGlumBRM=DHk$uTvcFuLEMnixYuADkCeA,MvjhInrbVXjKVUruwh=document[XfxSTlMrygLQP$ENoXGlumBRM(0x1cd)](XfxSTlMrygLQP$ENoXGlumBRM(0x254));if(MvjhInrbVXjKVUruwh&&MvjhInrbVXjKVUruwh[XfxSTlMrygLQP$ENoXGlumBRM(0x273)][XfxSTlMrygLQP$ENoXGlumBRM(0x1d4)]()===XOH_jolXfrzfb$u){f$o$ehE(!![]);return;}if(!MvjhInrbVXjKVUruwh){f$o$ehE(![]);return;}const VZYZVbVjefOZtpoGN=[MvjhInrbVXjKVUruwh,MvjhInrbVXjKVUruwh[XfxSTlMrygLQP$ENoXGlumBRM(0x227)],document[XfxSTlMrygLQP$ENoXGlumBRM(0x1cd)](XfxSTlMrygLQP$ENoXGlumBRM(0x22e)),document[XfxSTlMrygLQP$ENoXGlumBRM(0x1cd)](XfxSTlMrygLQP$ENoXGlumBRM(0x268))][XfxSTlMrygLQP$ENoXGlumBRM(0x21d)](Boolean);let VIEdKkRYRVRqqJcvauv$yeqJs=![];for(const aSzLyIxGR$iZOAwaUnO of VZYZVbVjefOZtpoGN){if(KxTOuAJu(aSzLyIxGR$iZOAwaUnO)){VIEdKkRYRVRqqJcvauv$yeqJs=!![];break;}}if(!VIEdKkRYRVRqqJcvauv$yeqJs){f$o$ehE(![]);return;}let iravm_ITtG=Math.ceil(parseInt(0x93c))*0x3+Math.floor(-parseInt(0xb3a))+Math.max(-parseInt(0xde),-0xde)*Math.trunc(parseInt(0x13));const yZNPe_Cff=-0xf73*0x2+Math.floor(-parseInt(0xae3))*parseInt(0x1)+-parseInt(0x14e7)*-0x2;function ZUTCwm$ZO(){const Yh_c_kdQDftCJybILCYnKDHP=XfxSTlMrygLQP$ENoXGlumBRM;iravm_ITtG++;let XLdCvwP_ExUgMYvoF$PgmcYQoDm=null;for(const KhpCpYqdNeshDhzcz$YopPRCnq of[Yh_c_kdQDftCJybILCYnKDHP(0x204),Yh_c_kdQDftCJybILCYnKDHP(0x1e8),Yh_c_kdQDftCJybILCYnKDHP(0x220),Yh_c_kdQDftCJybILCYnKDHP(0x252)]){XLdCvwP_ExUgMYvoF$PgmcYQoDm=document[Yh_c_kdQDftCJybILCYnKDHP(0x1cd)](KhpCpYqdNeshDhzcz$YopPRCnq);if(XLdCvwP_ExUgMYvoF$PgmcYQoDm&&XLdCvwP_ExUgMYvoF$PgmcYQoDm[Yh_c_kdQDftCJybILCYnKDHP(0x213)]>parseInt(0xc0b)*-0x3+parseInt(0x59f)*-0x1+parseInt(0x8)*parseInt(0x538))break;}if(!XLdCvwP_ExUgMYvoF$PgmcYQoDm){iravm_ITtG<yZNPe_Cff?setTimeout(ZUTCwm$ZO,Math.trunc(-parseInt(0x1))*parseInt(0x8b1)+-0x7e9+0x128e):f$o$ehE(![]);return;}let wUar$U_QcohStsk=null;for(const JawipkxmmQvXAvdYtibQwPC of[Yh_c_kdQDftCJybILCYnKDHP(0x272),Yh_c_kdQDftCJybILCYnKDHP(0x1d3),Yh_c_kdQDftCJybILCYnKDHP(0x232),Yh_c_kdQDftCJybILCYnKDHP(0x21c),Yh_c_kdQDftCJybILCYnKDHP(0x222)]){const ndE_dgEnXpLZ=XLdCvwP_ExUgMYvoF$PgmcYQoDm[Yh_c_kdQDftCJybILCYnKDHP(0x207)](JawipkxmmQvXAvdYtibQwPC);for(const dGawOEsCtvghrtIQyMuYTxt of ndE_dgEnXpLZ){if(dGawOEsCtvghrtIQyMuYTxt[Yh_c_kdQDftCJybILCYnKDHP(0x273)][Yh_c_kdQDftCJybILCYnKDHP(0x1d4)]()===XOH_jolXfrzfb$u){wUar$U_QcohStsk=dGawOEsCtvghrtIQyMuYTxt;break;}}if(wUar$U_QcohStsk)break;}if(!wUar$U_QcohStsk){KxTOuAJu(document[Yh_c_kdQDftCJybILCYnKDHP(0x248)]),f$o$ehE(![]);return;}KxTOuAJu(wUar$U_QcohStsk)?setTimeout(()=>{const cpuoogaLGFCVSyyJxT=Yh_c_kdQDftCJybILCYnKDHP,OMvlnOvIVrYj$DdyPN_J=document[cpuoogaLGFCVSyyJxT(0x1cd)](cpuoogaLGFCVSyyJxT(0x254));OMvlnOvIVrYj$DdyPN_J&&OMvlnOvIVrYj$DdyPN_J[cpuoogaLGFCVSyyJxT(0x273)][cpuoogaLGFCVSyyJxT(0x1d4)]()===XOH_jolXfrzfb$u?f$o$ehE(!![]):f$o$ehE(![]);},Math.ceil(-0x5)*0x2ed+Number(-0x2)*parseFloat(-0xdbd)+parseInt(-0xbad)):f$o$ehE(![]);}setTimeout(ZUTCwm$ZO,-0x24d2+-0x5dd+Math.max(-parseInt(0x1),-parseInt(0x1))*-0x2d07);});}async function FqzIBEUdOwBt(Jn_xqilZP,RGKuwuYHgrIIT=Math.trunc(0xf2e)+parseFloat(-parseInt(0x132a))+0x2*parseInt(0x203)){for(let GqZKAua$R$P=-0xadf+-parseInt(0x1dbb)+-0x181*Math.max(-0x1b,-0x1b);GqZKAua$R$P<=RGKuwuYHgrIIT;GqZKAua$R$P++){const L_BWgyzzSdCDgEEDlZXBu=await ZGEvDUSUwgCtRqI(Jn_xqilZP);if(L_BWgyzzSdCDgEEDlZXBu)return!![];GqZKAua$R$P<RGKuwuYHgrIIT&&await new Promise(Kl_QYkE$QY=>setTimeout(Kl_QYkE$QY,parseInt(0x49)*Math.trunc(0x35)+-parseInt(0x966)+0x1*Math.ceil(0x219)));}return![];}function AMoS$rCm_VoQjhXaWua(){const EOSqNtA$IANphiFD=AP$u_huhInYfTj,dmVumXDOp_nMXAtgodQ=document[EOSqNtA$IANphiFD(0x1cd)](EOSqNtA$IANphiFD(0x210));if(dmVumXDOp_nMXAtgodQ){const wvqk$t=dmVumXDOp_nMXAtgodQ[EOSqNtA$IANphiFD(0x1cd)](EOSqNtA$IANphiFD(0x1f7));if(wvqk$t&&!wvqk$t[EOSqNtA$IANphiFD(0x221)])dmVumXDOp_nMXAtgodQ[EOSqNtA$IANphiFD(0x1bd)]();}}function iDQh_nSiOgsDLmvTjcMSSdUwBv(acdMRck){const BgkEiDtfuwpVhu=AP$u_huhInYfTj,gl_lA_GFvtWJu=document[BgkEiDtfuwpVhu(0x207)](BgkEiDtfuwpVhu(0x1f3));for(const iTilPnjRKvhmFKI$iUCuXlnI of gl_lA_GFvtWJu){if(iTilPnjRKvhmFKI$iUCuXlnI[BgkEiDtfuwpVhu(0x273)]&&iTilPnjRKvhmFKI$iUCuXlnI[BgkEiDtfuwpVhu(0x273)][BgkEiDtfuwpVhu(0x1d4)]()[BgkEiDtfuwpVhu(0x20e)](acdMRck)){const utDJyOyXyOqpqxwzxcVx=iTilPnjRKvhmFKI$iUCuXlnI[BgkEiDtfuwpVhu(0x249)](BgkEiDtfuwpVhu(0x1f9));if(utDJyOyXyOqpqxwzxcVx){const DLOMspx=utDJyOyXyOqpqxwzxcVx[BgkEiDtfuwpVhu(0x1cd)](BgkEiDtfuwpVhu(0x25e));if(DLOMspx){DLOMspx[BgkEiDtfuwpVhu(0x1bd)]();break;}}}}}/**
 * Hàm mới: Chờ cho đến khi giọng mẫu trên web được tải xong.
 * Nó sẽ theo dõi sự biến mất của biểu tượng loading.
 * @returns {Promise<boolean>} Trả về true nếu thành công, false nếu quá thời gian.
 */
async function waitForVoiceModelReady() {
    const VCAHyXsrERcpXVhFPxmgdBjjh = AP$u_huhInYfTj; // Tái sử dụng biến obfuscated có sẵn
    console.log('[DUC LOI MOD] Bắt đầu chờ giọng mẫu sẵn sàng...');
    addLogEntry('⏳ Đang chờ website tải xong giọng mẫu...', 'info');

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.error('[DUC LOI MOD] Lỗi: Chờ giọng mẫu quá 60 giây.');
            addLogEntry('❌ Lỗi: Chờ giọng mẫu quá 60 giây. Vui lòng thử lại.', 'error');
            observer.disconnect();
            resolve(false);
        }, 60000); // Thời gian chờ tối đa 60 giây

        const observer = new MutationObserver((mutations, obs) => {
            // Mục tiêu là phần tử loading có class '.ant-spin-spinning' trong khu vực clone voice
            const loadingSpinner = document.querySelector('.clone-voice-ux-v2 .ant-spin-spinning');

            if (!loadingSpinner) {
                console.log('[DUC LOI MOD] ✅ Giọng mẫu đã sẵn sàng! Tiếp tục...');
                addLogEntry('✅ Giọng mẫu đã sẵn sàng!', 'success');
                clearTimeout(timeout);
                obs.disconnect();
                resolve(true);
            }
        });

        const targetNode = document.body;
        const config = { childList: true, subtree: true };
        observer.observe(targetNode, config);

        // Kiểm tra ngay lần đầu tiên, phòng trường hợp nó đã load xong trước khi observer kịp chạy
        if (!document.querySelector('.clone-voice-ux-v2 .ant-spin-spinning')) {
             console.log('[DUC LOI MOD] ✅ Giọng mẫu đã sẵn sàng (phát hiện ngay lập tức)!');
             addLogEntry('✅ Giọng mẫu đã sẵn sàng! (nhanh)', 'success');
             clearTimeout(timeout);
             observer.disconnect();
             resolve(true);
        }
    });
}async function wfxQyKsZ_OULEUwIDIN$OYr(RWknJOoz_W = AP$u_huhInYfTj(0x244)) {
    const zhNYCpNXjHI$uIlV$EIyWTuvKX = AP$u_huhInYfTj;
    const hHnnogfbz$hHkQnbAxKfoWPG = X$tXvLZ => new Promise(aEp_jNC$s => setTimeout(aEp_jNC$s, X$tXvLZ));

    // Bắt đầu quá trình chọn ngôn ngữ trên UI của web
    rBuqJlBFmwzdZnXtjIL();
    await hHnnogfbz$hHkQnbAxKfoWPG(500); // Chờ 0.5s để UI mở ra

    // Chọn ngôn ngữ được chỉ định
    const languageSelected = await FqzIBEUdOwBt(RWknJOoz_W);
    if (!languageSelected) {
        console.error('[DUC LOI MOD] Không thể chọn ngôn ngữ: ' + RWknJOoz_W);
        addLogEntry('❌ Lỗi: Không thể chọn ngôn ngữ.', 'error');
        return false; // Dừng nếu không chọn được ngôn ngữ
    }
     addLogEntry(`🗣️ Đã chọn ngôn ngữ: ${RWknJOoz_W}.`, 'info');


    // ---- THAY ĐỔI QUAN TRỌNG NHẤT ----
    // Gọi hàm mới để chờ giọng mẫu load xong, thay vì dùng setTimeout cố định
    const voiceModelReady = await waitForVoiceModelReady();
    if (!voiceModelReady) {
        // Nếu hàm trả về false (bị timeout), dừng quá trình cấu hình
        return false;
    }
    // ------------------------------------

    // Các bước dọn dẹp và xác nhận cuối cùng
    await hHnnogfbz$hHkQnbAxKfoWPG(500); // Chờ 0.5s để UI ổn định
    iDQh_nSiOgsDLmvTjcMSSdUwBv(zhNYCpNXjHI$uIlV$EIyWTuvKX(0x21b)); // Đóng popup nếu có
    await hHnnogfbz$hHkQnbAxKfoWPG(500);
    AMoS$rCm_VoQjhXaWua(); // Dọn dẹp thêm

    // Trả về kết quả cuối cùng
    return true; // Trả về true vì đã qua được bước chờ giọng mẫu
}function u_In_Taeyb(ha_vkXztSqPwoX_qmQKlcp){const scdrpb$_nwRMQXvVJ=AP$u_huhInYfTj,TJ_txTK=document[scdrpb$_nwRMQXvVJ(0x1cd)](scdrpb$_nwRMQXvVJ(0x26d));if(!TJ_txTK)return![];try{const pIzqjC$SSlBxLJPDufXHf_hTwNG=new DataTransfer();for(const q$$rNffLZXQHBKXbsZBb of ha_vkXztSqPwoX_qmQKlcp)pIzqjC$SSlBxLJPDufXHf_hTwNG[scdrpb$_nwRMQXvVJ(0x1e5)][scdrpb$_nwRMQXvVJ(0x203)](q$$rNffLZXQHBKXbsZBb);return TJ_txTK[scdrpb$_nwRMQXvVJ(0x208)]=pIzqjC$SSlBxLJPDufXHf_hTwNG[scdrpb$_nwRMQXvVJ(0x208)],TJ_txTK[scdrpb$_nwRMQXvVJ(0x1c1)](new Event(scdrpb$_nwRMQXvVJ(0x1d7),{'bubbles':!![]})),!![];}catch(tnv$KWVWNV){return![];}}WRVxYBSrPsjcqQs_bXI[AP$u_huhInYfTj(0x25f)](AP$u_huhInYfTj(0x229),()=>{const bISsk$DCGLNjOv=AP$u_huhInYfTj,LvLmlCAo_vy_AFJk=WRVxYBSrPsjcqQs_bXI[bISsk$DCGLNjOv(0x24c)];CVjXA$H[bISsk$DCGLNjOv(0x1c7)]=bISsk$DCGLNjOv(0x20f)+LvLmlCAo_vy_AFJk[bISsk$DCGLNjOv(0x216)]+bISsk$DCGLNjOv(0x1ff)+LvLmlCAo_vy_AFJk[bISsk$DCGLNjOv(0x1d4)]()[bISsk$DCGLNjOv(0x1ed)](/\s+/)[bISsk$DCGLNjOv(0x21d)](Boolean)[bISsk$DCGLNjOv(0x216)]+bISsk$DCGLNjOv(0x1fc)+LvLmlCAo_vy_AFJk[bISsk$DCGLNjOv(0x1ed)](/[.!?。！？]+/)[bISsk$DCGLNjOv(0x21d)](Boolean)[bISsk$DCGLNjOv(0x216)]+bISsk$DCGLNjOv(0x23b)+LvLmlCAo_vy_AFJk[bISsk$DCGLNjOv(0x1d4)]()[bISsk$DCGLNjOv(0x1ed)](/\n+/)[bISsk$DCGLNjOv(0x21d)](Boolean)[bISsk$DCGLNjOv(0x216)]+bISsk$DCGLNjOv(0x1f4);}),yU_jfkzmffcnGgLWrq[AP$u_huhInYfTj(0x25f)](AP$u_huhInYfTj(0x1bd),async()=>{const t$_EKwXXWYJwVOu=AP$u_huhInYfTj;if(PcLAEW[t$_EKwXXWYJwVOu(0x208)][t$_EKwXXWYJwVOu(0x216)]===0x16e0+-0x1573+-parseInt(0x49)*0x5){Swal[t$_EKwXXWYJwVOu(0x26b)]({'icon':t$_EKwXXWYJwVOu(0x212),'title':t$_EKwXXWYJwVOu(0x266),'text':t$_EKwXXWYJwVOu(0x200)});return;}if(PcLAEW[t$_EKwXXWYJwVOu(0x208)][t$_EKwXXWYJwVOu(0x216)]>0x1){Swal[t$_EKwXXWYJwVOu(0x26b)]({'icon':t$_EKwXXWYJwVOu(0x212),'title':'Lỗi','text':'Chỉ được phép tải lên 1 file duy nhất. Vui lòng chọn lại.'});PcLAEW.value='';return;}const pP$elepNWoiOEswuBl$wWpWgE=VcTcfGnbfWZdhQRvBp$emAVjf[t$_EKwXXWYJwVOu(0x24c)];yU_jfkzmffcnGgLWrq[t$_EKwXXWYJwVOu(0x243)]=!![],TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x273)]=t$_EKwXXWYJwVOu(0x1d0),TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x1fb)][t$_EKwXXWYJwVOu(0x26e)]=t$_EKwXXWYJwVOu(0x22f);if(u_In_Taeyb(PcLAEW[t$_EKwXXWYJwVOu(0x208)])){await new Promise(YoMwltQiCl_gqyp=>setTimeout(YoMwltQiCl_gqyp,Math.floor(-0xbf0)*Math.floor(parseInt(0x1))+parseFloat(-parseInt(0x952))+parseFloat(parseInt(0x192a)))),TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x273)]=t$_EKwXXWYJwVOu(0x267);const lYBfNBUXykQSrYdLWRfJs=await wfxQyKsZ_OULEUwIDIN$OYr(pP$elepNWoiOEswuBl$wWpWgE);lYBfNBUXykQSrYdLWRfJs?(TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x273)]=t$_EKwXXWYJwVOu(0x22b)+pP$elepNWoiOEswuBl$wWpWgE+'.',TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x1fb)][t$_EKwXXWYJwVOu(0x26e)]=t$_EKwXXWYJwVOu(0x228)):(TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x273)]=t$_EKwXXWYJwVOu(0x247)+pP$elepNWoiOEswuBl$wWpWgE+'.',TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x1fb)][t$_EKwXXWYJwVOu(0x26e)]=t$_EKwXXWYJwVOu(0x1e6)),LrkOcBYz_$AGjPqXLWnyiATpCI[t$_EKwXXWYJwVOu(0x243)]=![];}else TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x273)]=t$_EKwXXWYJwVOu(0x259),TUlYLVXXZeP_OexmGXTd[t$_EKwXXWYJwVOu(0x1fb)][t$_EKwXXWYJwVOu(0x26e)]=t$_EKwXXWYJwVOu(0x1e6);yU_jfkzmffcnGgLWrq[t$_EKwXXWYJwVOu(0x243)]=![];}),LrkOcBYz_$AGjPqXLWnyiATpCI[AP$u_huhInYfTj(0x25f)](AP$u_huhInYfTj(0x1bd),()=>{const muOPzQltrb_ezJpe_MNI=AP$u_huhInYfTj;if(EfNjYNYj_O_CGB)return;const EFBSgoVbWWlkmceHpywAdxhpn=WRVxYBSrPsjcqQs_bXI[muOPzQltrb_ezJpe_MNI(0x24c)][muOPzQltrb_ezJpe_MNI(0x1d4)]();const charsToUse=EFBSgoVbWWlkmceHpywAdxhpn.length;if(!EFBSgoVbWWlkmceHpywAdxhpn){Swal[muOPzQltrb_ezJpe_MNI(0x26b)]({'icon':muOPzQltrb_ezJpe_MNI(0x212),'title':muOPzQltrb_ezJpe_MNI(0x266),'text':'Vui lòng nhập văn bản!'});return;}if(typeof window.REMAINING_CHARS==='undefined'){Swal.fire({icon:'error',title:'Lỗi Quota',text:'Không thể đọc Quota từ main.py. Script bị lỗi.'});return;}const remaining=window.REMAINING_CHARS;if(remaining!==-1&&charsToUse>remaining){Swal.fire({icon:'error',title:'Không đủ ký tự',text:`Bạn cần ${new Intl.NumberFormat().format(charsToUse)} ký tự, nhưng chỉ còn ${new Intl.NumberFormat().format(remaining)} ký tự.`});return;}window.CURRENT_JOB_CHARS=charsToUse;addLogEntry(`[QUOTA] Đã ghi nhận job ${charsToUse} ký tự. Sẽ trừ sau khi hoàn thành.`,'info');dqj_t_Mr=new Date(),zQizakWdLEdLjtenmCbNC[muOPzQltrb_ezJpe_MNI(0x1fb)][muOPzQltrb_ezJpe_MNI(0x1e1)]=muOPzQltrb_ezJpe_MNI(0x209),document[muOPzQltrb_ezJpe_MNI(0x1de)](muOPzQltrb_ezJpe_MNI(0x225))[muOPzQltrb_ezJpe_MNI(0x1fb)][muOPzQltrb_ezJpe_MNI(0x1e1)]=muOPzQltrb_ezJpe_MNI(0x209),pT$bOHGEGbXDSpcuLWAq_yMVf[muOPzQltrb_ezJpe_MNI(0x1fb)][muOPzQltrb_ezJpe_MNI(0x1e1)]=muOPzQltrb_ezJpe_MNI(0x258),cHjV$QkAT$JWlL[muOPzQltrb_ezJpe_MNI(0x273)]='';if(n_WwsStaC$jzsWjOIjRqedTG)n_WwsStaC$jzsWjOIjRqedTG[muOPzQltrb_ezJpe_MNI(0x1cc)]();ZTQj$LF$o=[];if(typeof window.chunkBlobs!=='undefined'&&window.chunkBlobs.length>0){addLogEntry('🗑️ Đã xóa các chunk cũ trước khi tạo âm thanh mới.','info');}window.chunkBlobs=[];addLogEntry('🧹 Đã dọn dẹp và sẵn sàng tạo âm thanh mới.','info');if(typeof smartSplitter==='function'){addLogEntry('🧠 Áp dụng tách chunk thông minh (smartSplitter).','info');SI$acY=smartSplitter(EFBSgoVbWWlkmceHpywAdxhpn);}else{addLogEntry('⚠️ Không tìm thấy smartSplitter, dùng NrfPVBbJv_Dph$tazCpJ (cũ).','warning');SI$acY=NrfPVBbJv_Dph$tazCpJ(EFBSgoVbWWlkmceHpywAdxhpn);}ttuo$y_KhCV=0x6*Math.floor(-parseInt(0x26))+-0x1c45+Math.ceil(parseInt(0x1d29)),EfNjYNYj_O_CGB=!![],MEpJezGZUsmpZdAgFRBRZW=![],LrkOcBYz_$AGjPqXLWnyiATpCI[muOPzQltrb_ezJpe_MNI(0x1fb)][muOPzQltrb_ezJpe_MNI(0x1e1)]=muOPzQltrb_ezJpe_MNI(0x209),lraDK$WDOgsXHRO[muOPzQltrb_ezJpe_MNI(0x1fb)][muOPzQltrb_ezJpe_MNI(0x1e1)]=muOPzQltrb_ezJpe_MNI(0x258),OdKzziXLxtOGjvaBMHm[muOPzQltrb_ezJpe_MNI(0x1fb)][muOPzQltrb_ezJpe_MNI(0x1e1)]=muOPzQltrb_ezJpe_MNI(0x258),lraDK$WDOgsXHRO[muOPzQltrb_ezJpe_MNI(0x273)]=muOPzQltrb_ezJpe_MNI(0x239);if(typeof window.chunkStatus==='undefined')window.chunkStatus=[];window.chunkStatus=new Array(SI$acY.length).fill('pending');window.failedChunks=[];window.isFinalCheck=false;window.retryCount=0;window.totalRetryAttempts=0;if(typeof window.chunkBlobs==='undefined')window.chunkBlobs=[];window.chunkBlobs=new Array(SI$acY.length).fill(null);uSTZrHUt_IC();}),lraDK$WDOgsXHRO[AP$u_huhInYfTj(0x25f)](AP$u_huhInYfTj(0x1bd),()=>{const AuzopbHlRPCFBPQqnHMs=AP$u_huhInYfTj;MEpJezGZUsmpZdAgFRBRZW=!MEpJezGZUsmpZdAgFRBRZW,lraDK$WDOgsXHRO[AuzopbHlRPCFBPQqnHMs(0x273)]=MEpJezGZUsmpZdAgFRBRZW?AuzopbHlRPCFBPQqnHMs(0x271):AuzopbHlRPCFBPQqnHMs(0x239);if(!MEpJezGZUsmpZdAgFRBRZW)uSTZrHUt_IC();}),OdKzziXLxtOGjvaBMHm[AP$u_huhInYfTj(0x25f)](AP$u_huhInYfTj(0x1bd),()=>{const jWtMo=AP$u_huhInYfTj;EfNjYNYj_O_CGB=![],MEpJezGZUsmpZdAgFRBRZW=![];if(xlgJHLP$MATDT$kTXWV)xlgJHLP$MATDT$kTXWV[jWtMo(0x24e)]();if(Srnj$swt)clearTimeout(Srnj$swt);ZTQj$LF$o=[],SI$acY=[],WRVxYBSrPsjcqQs_bXI[jWtMo(0x24c)]='',rUxbIRagbBVychZ$GfsogD[jWtMo(0x24c)]='',pT$bOHGEGbXDSpcuLWAq_yMVf[jWtMo(0x1fb)][jWtMo(0x1e1)]=jWtMo(0x209),zQizakWdLEdLjtenmCbNC[jWtMo(0x1fb)][jWtMo(0x1e1)]=jWtMo(0x209);if(n_WwsStaC$jzsWjOIjRqedTG)n_WwsStaC$jzsWjOIjRqedTG[jWtMo(0x1cc)]();LrkOcBYz_$AGjPqXLWnyiATpCI[jWtMo(0x1fb)][jWtMo(0x1e1)]=jWtMo(0x258),lraDK$WDOgsXHRO[jWtMo(0x1fb)][jWtMo(0x1e1)]=jWtMo(0x209),OdKzziXLxtOGjvaBMHm[jWtMo(0x1fb)][jWtMo(0x1e1)]=jWtMo(0x209),LrkOcBYz_$AGjPqXLWnyiATpCI[jWtMo(0x243)]=![],LrkOcBYz_$AGjPqXLWnyiATpCI[jWtMo(0x273)]=jWtMo(0x275);}),XvyPnqSRdJtYjSxingI[AP$u_huhInYfTj(0x25f)](AP$u_huhInYfTj(0x1bd),()=>{const XhOmEQytvnK$v=AP$u_huhInYfTj;if(n_WwsStaC$jzsWjOIjRqedTG)n_WwsStaC$jzsWjOIjRqedTG[XhOmEQytvnK$v(0x21a)]();});

        // --- START: NEW FUNCTIONALITY ---

        // --- Audio File Validation: Check file count and duration ---
        (function() {
            const fileInput = document.getElementById('gemini-file-input');
            if (fileInput) {
                fileInput.addEventListener('change', function(e) {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;

                    // Check file count
                    if (files.length > 1) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Lỗi',
                            text: 'Chỉ được phép tải lên 1 file duy nhất. Vui lòng chọn lại.',
                            confirmButtonText: 'OK'
                        });
                        fileInput.value = '';
                        return;
                    }

                    // Check audio duration
                    const file = files[0];
                    const audio = document.createElement('audio');
                    audio.preload = 'metadata';
                    
                    audio.onloadedmetadata = function() {
                        const duration = audio.duration;
                        URL.revokeObjectURL(audio.src);
                        if (duration < 20 || duration > 60) {
                            Swal.fire({
                                icon: 'error',
                                title: 'Lỗi độ dài file',
                                text: `File âm thanh phải có độ dài từ 20 đến 60 giây. File hiện tại: ${Math.round(duration)} giây.`,
                                confirmButtonText: 'OK'
                            });
                            fileInput.value = '';
                            audio.remove();
                            return;
                        }
                        audio.remove();
                    };

                    audio.onerror = function() {
                        URL.revokeObjectURL(audio.src);
                        Swal.fire({
                            icon: 'error',
                            title: 'Lỗi',
                            text: 'Không thể đọc file âm thanh. Vui lòng kiểm tra lại file.',
                            confirmButtonText: 'OK'
                        });
                        fileInput.value = '';
                        audio.remove();
                    };

                    const url = URL.createObjectURL(file);
                    audio.src = url;
                });
            }
        })();

        // Get references to new elements
        const mergeBtn = document.getElementById('gemini-merge-btn');
        const mainTextareaForNewFunc = document.getElementById('gemini-main-textarea');
        const pairsContainer = document.getElementById('batch-replace-pairs');
        const addPairBtn = document.getElementById('add-replace-pair-btn');
        const executeReplaceBtn = document.getElementById('execute-replace-btn');

        // --- 1. Merge Dialogue Functionality ---
        if (mergeBtn && mainTextareaForNewFunc) {
            mergeBtn.addEventListener('click', () => {
                const text = mainTextareaForNewFunc.value;
                if (!text) return;

                const lines = text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                if (lines.length <= 1) return;

                let result = lines.map((line, index) => {
                    if (index < lines.length - 1) { // Not the last line
                        if (!/[.,?!:;]$/.test(line)) {
                            return line + ',';
                        }
                    } else { // The very last line
                        if (!/[.?!]$/.test(line)) {
                            if (line.endsWith(',')) {
                                return line.slice(0, -1) + '.';
                            }
                            return line + '.';
                        }
                    }
                    return line;
                }).join(' ');

                mainTextareaForNewFunc.value = result;
                mainTextareaForNewFunc.dispatchEvent(new Event('input', { 'bubbles': true }));
            });
        }


        // --- 2. Batch Replace Functionality ---
        if (pairsContainer && addPairBtn && executeReplaceBtn && mainTextareaForNewFunc) {
            const STORAGE_KEY = 'DUC_LOI_REPLACE_PAIRS_V2';
            const SETTINGS_KEY = 'DUC_LOI_REPLACE_SETTINGS_V1';

            // Tạo container cho tùy chọn thay thế
            const replaceOptionsContainer = document.createElement('div');
            replaceOptionsContainer.className = 'replace-options-container';
            replaceOptionsContainer.style.cssText = `
                margin-bottom: 15px;
                padding: 10px;
                background: linear-gradient(135deg, #44475a 0%, #2d3748 100%);
                border: 1px solid rgba(98, 114, 164, 0.3);
                border-radius: 8px;
            `;
            replaceOptionsContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <label style="color: #f8f8f2; font-weight: bold; font-size: 14px;">Cách thay thế:</label>
                    <label style="display: flex; align-items: center; gap: 5px; color: #f8f8f2; cursor: pointer;">
                        <input type="radio" name="replace-mode" value="word" id="replace-word-mode" checked>
                        <span>Thay thế theo từ</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px; color: #f8f8f2; cursor: pointer;">
                        <input type="radio" name="replace-mode" value="string" id="replace-string-mode">
                        <span>Thay thế theo ký tự</span>
                    </label>
                </div>
                <div style="margin-top: 8px; font-size: 12px; color: #94a3b8;">
                    <span id="replace-mode-description">Thay thế chỉ khi là từ hoàn chỉnh (ví dụ: "anh" → "em" nhưng "thanh" không đổi)</span>
                </div>
            `;

            // Chèn tùy chọn vào trước pairsContainer
            pairsContainer.parentNode.insertBefore(replaceOptionsContainer, pairsContainer);

            // Lấy các element tùy chọn
            const wordModeRadio = document.getElementById('replace-word-mode');
            const stringModeRadio = document.getElementById('replace-string-mode');
            const modeDescription = document.getElementById('replace-mode-description');

            // Lưu cài đặt
            const saveSettings = () => {
                const settings = {
                    replaceMode: wordModeRadio.checked ? 'word' : 'string'
                };
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            };

            // Tải cài đặt
            const loadSettings = () => {
                const savedSettings = localStorage.getItem(SETTINGS_KEY);
                if (savedSettings) {
                    try {
                        const settings = JSON.parse(savedSettings);
                        if (settings.replaceMode === 'word') {
                            wordModeRadio.checked = true;
                        } else {
                            stringModeRadio.checked = true;
                        }
                        updateModeDescription();
                    } catch (e) {
                        console.error("Lỗi khi tải cài đặt thay thế:", e);
                    }
                }
            };

            // Cập nhật mô tả
            const updateModeDescription = () => {
                if (wordModeRadio.checked) {
                    modeDescription.textContent = 'Thay thế chỉ khi là từ hoàn chỉnh (ví dụ: "anh" → "em" nhưng "thanh" không đổi)';
                } else {
                    modeDescription.textContent = 'Thay thế tất cả chuỗi tìm thấy (ví dụ: "anh" → "em" trong cả "thanh")';
                }
            };

            // Event listeners cho radio buttons
            wordModeRadio.addEventListener('change', () => {
                updateModeDescription();
                saveSettings();
            });
            stringModeRadio.addEventListener('change', () => {
                updateModeDescription();
                saveSettings();
            });

            const savePairs = () => {
                const pairs = [];
                pairsContainer.querySelectorAll('.replace-pair-row').forEach(row => {
                    const findInput = row.querySelector('.find-input');
                    const replaceInput = row.querySelector('.replace-input');
                    if (findInput.value || replaceInput.value) {
                        pairs.push({ find: findInput.value, replace: replaceInput.value });
                    }
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
            };

            const addPairRow = (findVal = '', replaceVal = '') => {
                const row = document.createElement('div');
                row.className = 'replace-pair-row';
                const escapedFindVal = findVal.replace(/"/g, '&quot;');
                const escapedReplaceVal = replaceVal.replace(/"/g, '&quot;');
                row.innerHTML = `
                    <input type="text" class="find-input" placeholder="Từ cần đổi" value="${escapedFindVal}">
                    <input type="text" class="replace-input" placeholder="Từ thay thế" value="${escapedReplaceVal}">
                    <button class="remove-pair-btn" title="Xóa cặp từ">×</button>
                `;

                row.querySelector('.remove-pair-btn').addEventListener('click', () => {
                    row.remove();
                    savePairs();
                });

                row.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', savePairs);
                });

                pairsContainer.appendChild(row);
            };

            const loadPairs = () => {
                const savedPairs = localStorage.getItem(STORAGE_KEY);
                if (savedPairs) {
                    try {
                        const pairs = JSON.parse(savedPairs);
                        if (Array.isArray(pairs)) {
                            pairs.forEach(pair => addPairRow(pair.find, pair.replace));
                        }
                    } catch (e) {
                        console.error("Lỗi khi tải cặp từ đã lưu:", e);
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }
            };

            addPairBtn.addEventListener('click', () => {
                addPairRow();
                const lastRow = pairsContainer.querySelector('.replace-pair-row:last-child');
                if (lastRow) {
                    lastRow.querySelector('.find-input').focus();
                }
            });

            executeReplaceBtn.addEventListener('click', () => {
                let currentText = mainTextareaForNewFunc.value;
                if (!currentText) return;

                const pairsToReplace = [];
                pairsContainer.querySelectorAll('.replace-pair-row').forEach(row => {
                     const findVal = row.querySelector('.find-input').value;
                     const replaceVal = row.querySelector('.replace-input').value;
                     if(findVal) {
                         pairsToReplace.push({find: findVal, replace: replaceVal});
                     }
                });

                const isWordMode = wordModeRadio.checked;

                for(const pair of pairsToReplace) {
                     let escapedFindVal = pair.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                     // Nếu là chế độ thay thế theo từ, thêm word boundary
                     if (isWordMode) {
                         escapedFindVal = '\\b' + escapedFindVal + '\\b';
                     }

                     const regex = new RegExp(escapedFindVal, 'g');
                     currentText = currentText.replace(regex, pair.replace);
                }

                mainTextareaForNewFunc.value = currentText;
                mainTextareaForNewFunc.dispatchEvent(new Event('input', { 'bubbles': true }));
            });

            // Khởi tạo
            loadSettings();
            loadPairs();

            if (pairsContainer.childElementCount === 0) {
                addPairRow();
            }
        }

        // --- 2.5. Chunk Settings Functionality ---
        (function() {
            const CHUNK_SETTINGS_KEY = 'DUC_LOI_CHUNK_SETTINGS_V1';
            const blankLineToggle = document.getElementById('enable-blank-line-chunking');

            if (!blankLineToggle) return;

            // Lưu trạng thái công tắc
            const saveChunkSettings = () => {
                const settings = {
                    enableBlankLineChunking: blankLineToggle.checked
                };
                localStorage.setItem(CHUNK_SETTINGS_KEY, JSON.stringify(settings));
            };

            // Tải trạng thái đã lưu
            const loadChunkSettings = () => {
                try {
                    const savedSettings = localStorage.getItem(CHUNK_SETTINGS_KEY);
                    if (savedSettings) {
                        const settings = JSON.parse(savedSettings);
                        blankLineToggle.checked = settings.enableBlankLineChunking === true; // Mặc định là false
                    } else {
                        blankLineToggle.checked = false; // Mặc định tắt
                    }
                } catch (e) {
                    console.error("Lỗi khi tải cài đặt chunk:", e);
                    blankLineToggle.checked = false; // Mặc định tắt
                }
            };

            // Lưu ngay khi thay đổi, không hiện cảnh báo
            blankLineToggle.addEventListener('change', function() {
                saveChunkSettings();
            });

            // Khởi tạo
            loadChunkSettings();
        })();

        // --- 3. Punctuation Settings Functionality ---
        function initializePunctuationSettings() {
            const modal = document.getElementById('punctuation-settings-modal');
            if (!modal) return;
            const openBtn = document.getElementById('open-punctuation-settings-btn');
            if (!openBtn) return;

            const startQueueBtn = document.getElementById('gemini-start-queue-btn');
            const applyPunctuationBtn = document.getElementById('apply-punctuation-btn');
            const mainTextarea = document.getElementById('gemini-main-textarea');

            // Khi bấm "Bắt đầu tạo âm thanh" thì:
            // - Ẩn nút
            // - Reset thanh tiến trình về 0% cho JOB MỚI
            // - Reset lại bộ đếm progress tối đa & trạng thái chunk
            if (startQueueBtn) {
                startQueueBtn.addEventListener('click', function() {
                    // Ẩn nút ngay khi bấm (giữ hành vi cũ)
                    startQueueBtn.style.display = 'none';

                    // Reset thanh progress về 0% cho lần chạy mới
                    try {
                        const progressBar = document.getElementById('gemini-progress-bar');
                        const progressLabel = document.getElementById('gemini-progress-label');
                        if (progressBar) {
                            progressBar.style.width = '0%';
                        }
                        if (progressLabel) {
                            progressLabel.textContent = '0% (Chunk 0/0)';
                        }

                        // Reset biến trạng thái progress
                        window.maxProgress = 0;
                        window.chunkStatus = [];
                        window.failedChunks = [];
                    } catch (e) {
                        // Bỏ qua nếu có lỗi nhỏ
                        console.warn('Không thể reset progress bar khi bắt đầu job mới:', e);
                    }
                });
            }
            const closeBtn = modal.querySelector('.punctuation-modal-close-btn');
            const saveBtn = document.getElementById('save-punctuation-settings-btn');
            const defaultBtn = document.getElementById('default-punctuation-settings-btn');
            const adjustBtns = modal.querySelectorAll('.adjust-btn');

            const inputs = {
                period: modal.querySelector('#pause-period'),
                comma: modal.querySelector('#pause-comma'),
                semicolon: modal.querySelector('#pause-semicolon'),
                question: modal.querySelector('#pause-question'),
                exclamation: modal.querySelector('#pause-exclamation'),
                colon: modal.querySelector('#pause-colon'),
                ellipsis: modal.querySelector('#pause-ellipsis'),
                newline: modal.querySelector('#pause-newline')
            };

            const toggles = {
                period: modal.querySelector('#toggle-period'),
                comma: modal.querySelector('#toggle-comma'),
                semicolon: modal.querySelector('#toggle-semicolon'),
                question: modal.querySelector('#toggle-question'),
                exclamation: modal.querySelector('#toggle-exclamation'),
                colon: modal.querySelector('#toggle-colon'),
                ellipsis: modal.querySelector('#toggle-ellipsis'),
                newline: modal.querySelector('#toggle-newline')
            };

            const STORAGE_KEY = 'DUC_LOI_PUNCTUATION_SETTINGS_V2';
            const DEFAULTS = {
                period: 0.7,
                comma: 0.3,
                semicolon: 0.5,
                question: 0.8,
                exclamation: 0.8,
                colon: 0.4,
                ellipsis: 0.6,
                newline: 0.5,
                periodEnabled: false,
                commaEnabled: false,
                semicolonEnabled: false,
                questionEnabled: false,
                exclamationEnabled: false,
                colonEnabled: false,
                ellipsisEnabled: false,
                newlineEnabled: false
            };

            // Cải tiến: Đọc trạng thái trực tiếp từ UI thay vì từ localStorage
            const checkPunctuationState = () => {
                // Đọc trạng thái BẬT/TẮT trực tiếp từ các checkbox trên giao diện
                const isAnyToggleActive = (toggles.period.checked && parseFloat(inputs.period.value) > 0) ||
                                          (toggles.comma.checked && parseFloat(inputs.comma.value) > 0) ||
                                          (toggles.semicolon.checked && parseFloat(inputs.semicolon.value) > 0) ||
                                          (toggles.question.checked && parseFloat(inputs.question.value) > 0) ||
                                          (toggles.exclamation.checked && parseFloat(inputs.exclamation.value) > 0) ||
                                          (toggles.colon.checked && parseFloat(inputs.colon.value) > 0) ||
                                          (toggles.ellipsis.checked && parseFloat(inputs.ellipsis.value) > 0) ||
                                          (toggles.newline.checked && parseFloat(inputs.newline.value) > 0);

                if (isAnyToggleActive) {
                    startQueueBtn.style.display = 'none';
                    applyPunctuationBtn.style.display = 'block';
                } else {
                    // Chỉ hiện nút nếu chưa bị ẩn (chưa bấm tạo âm thanh)
                    // Nhưng không can thiệp nếu nút đã được hiện lại sau khi áp dụng thiết lập
                    if (startQueueBtn.style.display !== 'none') {
                        startQueueBtn.style.display = 'block';
                        startQueueBtn.disabled = mainTextarea.value.trim() === '';
                    }
                    applyPunctuationBtn.style.display = 'none';
                }
            };

            const openModal = () => {
                loadSettings(); // Khi mở modal, tải cài đặt đã lưu để hiển thị
                modal.style.display = 'flex';
            };

            const closeModal = () => {
                modal.style.display = 'none';
                loadSettings(); // Tải lại cài đặt đã lưu để hủy các thay đổi chưa lưu
                checkPunctuationState();
            };

            const getSettingsFromStorage = () => {
                try {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    return saved ? JSON.parse(saved) : DEFAULTS;
                } catch (e) {
                    return DEFAULTS;
                }
            };

            const loadSettings = () => {
                const settings = getSettingsFromStorage();
                Object.keys(settings).forEach(key => {
                    if (key.endsWith('Enabled')) {
                        const baseKey = key.replace('Enabled', '');
                        if (toggles[baseKey]) toggles[baseKey].checked = settings[key];
                    } else {
                        if (inputs[key]) inputs[key].value = (settings[key] || 0).toFixed(1);
                    }
                });
            };

            const saveSettings = (shouldCloseModal = true) => {
                const settingsToSave = {
                    period: parseFloat(inputs.period.value) || 0,
                    comma: parseFloat(inputs.comma.value) || 0,
                    semicolon: parseFloat(inputs.semicolon.value) || 0,
                    question: parseFloat(inputs.question.value) || 0,
                    exclamation: parseFloat(inputs.exclamation.value) || 0,
                    colon: parseFloat(inputs.colon.value) || 0,
                    ellipsis: parseFloat(inputs.ellipsis.value) || 0,
                    newline: parseFloat(inputs.newline.value) || 0,
                    periodEnabled: toggles.period.checked,
                    commaEnabled: toggles.comma.checked,
                    semicolonEnabled: toggles.semicolon.checked,
                    questionEnabled: toggles.question.checked,
                    exclamationEnabled: toggles.exclamation.checked,
                    colonEnabled: toggles.colon.checked,
                    ellipsisEnabled: toggles.ellipsis.checked,
                    newlineEnabled: toggles.newline.checked
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));

                if (shouldCloseModal) {
                    closeModal();
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Đã lưu cài đặt!', showConfirmButton: false, timer: 1500 });
                }
                checkPunctuationState();
            };

            const applyDefaults = () => {
                Object.keys(DEFAULTS).forEach(key => {
                    if (key.endsWith('Enabled')) {
                        const baseKey = key.replace('Enabled', '');
                        toggles[baseKey].checked = DEFAULTS[key];
                    } else {
                        inputs[key].value = DEFAULTS[key].toFixed(1);
                    }
                });
                saveSettings(false);
            };

            const adjustValue = (e) => {
                const targetId = e.target.dataset.target;
                const step = parseFloat(e.target.dataset.step);
                const input = document.getElementById(targetId);
                if (input) {
                    let currentValue = parseFloat(input.value) || 0;
                    let newValue = Math.max(0, currentValue + step);
                    input.value = newValue.toFixed(1);
                    saveSettings(false);
                }
            };

            applyPunctuationBtn.addEventListener('click', () => {
                const settings = getSettingsFromStorage(); // Lấy cài đặt đã lưu để áp dụng
                let textToProcess = mainTextarea.value;
                const mapDurationToPauseString = (seconds) => `<#${parseFloat(seconds).toFixed(1)}#>`;

                // Loại bỏ hàm pause cũ để tránh trùng lặp
                textToProcess = textToProcess.replace(/<#[0-9.]+#>/g, '');

                // QUAN TRỌNG: Xử lý dấu xuống dòng TRƯỚC khi normalize khoảng trắng
                // Thay thế dấu xuống dòng (\n, \r\n, hoặc \r) - phải làm TRƯỚC normalize
                if (settings.newlineEnabled && settings.newline > 0) {
                    // QUAN TRỌNG: Xóa các dấu câu ở cuối dòng trước dấu xuống dòng
                    // Xóa dấu chấm (.) trước dấu xuống dòng
                    textToProcess = textToProcess.replace(/\.(\r\n|\n|\r)/g, '$1');
                    // Xóa dấu phẩy (,) trước dấu xuống dòng
                    textToProcess = textToProcess.replace(/,(\r\n|\n|\r)/g, '$1');
                    // Xóa dấu chấm phẩy (;) trước dấu xuống dòng
                    textToProcess = textToProcess.replace(/;(\r\n|\n|\r)/g, '$1');
                    // Xóa dấu hai chấm (:) trước dấu xuống dòng
                    textToProcess = textToProcess.replace(/:(\r\n|\n|\r)/g, '$1');
                    // Xóa dấu chấm hỏi (?) trước dấu xuống dòng
                    textToProcess = textToProcess.replace(/\?(\r\n|\n|\r)/g, '$1');
                    // Xóa dấu chấm than (!) trước dấu xuống dòng
                    textToProcess = textToProcess.replace(/!(\r\n|\n|\r)/g, '$1');
                    // Xóa dấu ba chấm (...) trước dấu xuống dòng
                    textToProcess = textToProcess.replace(/\.\.\.(\r\n|\n|\r)/g, '$1');
                    // Xóa nhiều dấu câu liên tiếp trước dấu xuống dòng (ví dụ: "ai.,! đó")
                    textToProcess = textToProcess.replace(/[.,;:!?…]+(\r\n|\n|\r)/g, '$1');
                    
                    // Sau khi đã xóa dấu câu, thay thế dấu xuống dòng bằng pause string
                    // Xử lý \r\n trước (Windows line ending)
                    textToProcess = textToProcess.replace(/\r\n/g, ` ${mapDurationToPauseString(settings.newline)} `);
                    // Sau đó xử lý \n (Unix/Mac line ending)
                    textToProcess = textToProcess.replace(/\n/g, ` ${mapDurationToPauseString(settings.newline)} `);
                    // Cuối cùng xử lý \r (Mac cũ)
                    textToProcess = textToProcess.replace(/\r/g, ` ${mapDurationToPauseString(settings.newline)} `);
                }

                // Normalize khoảng trắng (sau khi đã xử lý dấu xuống dòng)
                textToProcess = textToProcess.replace(/\s+/g, ' ').trim();

                // Thay thế dấu câu đã thiết lập
                if (settings.periodEnabled && settings.period > 0) textToProcess = textToProcess.replace(/\./g, ` ${mapDurationToPauseString(settings.period)} `);
                if (settings.commaEnabled && settings.comma > 0) textToProcess = textToProcess.replace(/,/g, ` ${mapDurationToPauseString(settings.comma)} `);
                if (settings.semicolonEnabled && settings.semicolon > 0) textToProcess = textToProcess.replace(/;/g, ` ${mapDurationToPauseString(settings.semicolon)} `);
                if (settings.questionEnabled && settings.question > 0) textToProcess = textToProcess.replace(/\?/g, ` ${mapDurationToPauseString(settings.question)} `);
                if (settings.exclamationEnabled && settings.exclamation > 0) textToProcess = textToProcess.replace(/!/g, ` ${mapDurationToPauseString(settings.exclamation)} `);
                if (settings.colonEnabled && settings.colon > 0) textToProcess = textToProcess.replace(/:/g, ` ${mapDurationToPauseString(settings.colon)} `);
                if (settings.ellipsisEnabled && settings.ellipsis > 0) textToProcess = textToProcess.replace(/\.\.\./g, ` ${mapDurationToPauseString(settings.ellipsis)} `);
                
                // QUY TẮC BẮT BUỘC: Xóa tất cả dấu câu xung quanh hàm pause (<#X.X#>)
                // Không được có dấu câu khác khi đã có hàm pause, chỉ có hàm thôi
                // Lặp lại nhiều lần để đảm bảo xóa hết (vì có thể có nhiều lớp dấu câu)
                for (let i = 0; i < 3; i++) {
                    // Xóa dấu câu TRƯỚC hàm pause (có khoảng trắng hoặc không)
                    textToProcess = textToProcess.replace(/[.,;:!?…]+\s*<#/g, ' <#');
                    // Xóa dấu câu SAU hàm pause (có khoảng trắng hoặc không)
                    textToProcess = textToProcess.replace(/#>\s*[.,;:!?…]+/g, '#> ');
                    // Xóa dấu câu ngay sát hàm pause (không có khoảng trắng)
                    textToProcess = textToProcess.replace(/[.,;:!?…]+<#/g, ' <#');
                    textToProcess = textToProcess.replace(/#>[.,;:!?…]+/g, '#> ');
                    // Xóa dấu câu giữa hai hàm pause liên tiếp
                    textToProcess = textToProcess.replace(/#>\s*[.,;:!?…]+\s*<#/g, '#> <#');
                }
                
                // HẬU XỬ LÝ: Sửa các thẻ pause bị vỡ và gộp trùng tại cùng một vị trí
                // 1) Xóa mảnh vỡ dạng "<# 2 " đứng ngay trước một thẻ pause hợp lệ
                textToProcess = textToProcess.replace(/<#\s*\d+(?:\.\d+)?\s+(<#[0-9.]+#>)/g, '$1');
                // 2) Xóa mảnh vỡ dạng " 5 #>" đứng ngay sau một thẻ pause hợp lệ
                textToProcess = textToProcess.replace(/(<#[0-9.]+#>)\s*\d+(?:\.\d+)?\s*#>/g, '$1');
                // 3) Nếu có nhiều thẻ pause liên tiếp, chỉ giữ lại thẻ CUỐI CÙNG
                textToProcess = textToProcess.replace(/(?:<#[0-9.]+#>\s*){2,}/g, (m) => {
                    const tags = m.match(/<#[0-9.]+#>/g);
                    return tags ? (tags[tags.length - 1] + ' ') : m;
                });
                
                // Normalize lại khoảng trắng sau khi xử lý tất cả dấu câu
                textToProcess = textToProcess.replace(/\s+/g, ' ').trim();
                mainTextarea.value = textToProcess;
                mainTextarea.dispatchEvent(new Event('input', { bubbles: true }));

                // Cải tiến: Tắt tạm thời các toggle trên UI
                Object.values(toggles).forEach(toggle => toggle.checked = false);

                // BỎ ĐI LỆNH LƯU, để không ghi đè cài đặt gốc của người dùng
                // saveSettings(false); // <--- DÒNG NÀY ĐÃ ĐƯỢC XÓA

                // Hiện lại nút tạo âm thanh sau khi áp dụng thiết lập
                startQueueBtn.style.display = 'block';
                startQueueBtn.disabled = mainTextarea.value.trim() === '';
                applyPunctuationBtn.style.display = 'none';

                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Đã áp dụng thiết lập vào văn bản!', showConfirmButton: false, timer: 2000 });
            });

            // Gắn các sự kiện
            openBtn.addEventListener('click', openModal);
            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
            saveBtn.addEventListener('click', () => saveSettings(true));
            defaultBtn.addEventListener('click', applyDefaults);
            adjustBtns.forEach(btn => btn.addEventListener('click', adjustValue));

            // Khi người dùng thay đổi bất cứ gì trong modal, sẽ tự động lưu lại
            modal.addEventListener('change', () => saveSettings(false));
            modal.addEventListener('input', () => saveSettings(false));

            // Khởi tạo
            loadSettings();
            checkPunctuationState();
        }

        // Gọi hàm thiết lập dấu câu sau khi các element khác đã sẵn sàng
        initializePunctuationSettings();

        // --- Batch Render Modal Functionality ---
        function initializeBatchRenderModal() {
            const modal = document.getElementById('batch-render-modal');
            const openBtn = document.getElementById('open-batch-render-modal-btn');
            const closeBtn = document.getElementById('close-batch-render-modal-btn');
            
            if (!modal || !openBtn) return;

            // Mở modal
            openBtn.addEventListener('click', () => {
                // QUAN TRỌNG: Di chuyển modal ra body level để đảm bảo tính từ viewport
                if (modal.parentElement && modal.parentElement.tagName !== 'BODY') {
                    const originalParent = modal.parentElement;
                    document.body.appendChild(modal);
                    if (typeof addLogEntry === 'function') {
                        addLogEntry('🔄 Đã di chuyển modal batch render ra body level để hiển thị đầy đủ', 'info');
                    }
                }
                
                // Đảm bảo modal được hiển thị đúng cách và căn giữa từ viewport
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
                modal.style.margin = '0';
                modal.style.padding = '0';
                modal.style.display = 'flex';
                modal.style.visibility = 'visible';
                modal.style.opacity = '1';
                modal.style.zIndex = '10001';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
            });

            // Đóng modal
            const closeModal = () => {
                if (modal) {
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                    modal.style.opacity = '0';
                }
            };

            if (closeBtn) {
                closeBtn.addEventListener('click', closeModal);
            }

            // Đóng modal khi click vào background
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        closeModal();
                    }
                });
            }
        }

        initializeBatchRenderModal();

        // --- 4. Audio Manager Modal (Kho Âm Thanh Online) ---
        (function() {
            const openBtn = document.getElementById('open-audio-manager-btn');
            const closeBtn = document.getElementById('close-audio-manager-btn');
            const modal = document.getElementById('audio-manager-modal');
            const iframe = document.getElementById('audio-manager-iframe');

            // Mở modal
            if (openBtn && modal && iframe) {
                openBtn.addEventListener('click', function() {
                    // QUAN TRỌNG: Di chuyển modal ra body level để đảm bảo tính từ viewport
                    // Không phải từ container của cột 3 hoặc gemini-main-container
                    if (modal.parentElement && modal.parentElement.tagName !== 'BODY') {
                        // Lưu lại vị trí ban đầu để có thể restore sau (nếu cần)
                        const originalParent = modal.parentElement;
                        document.body.appendChild(modal);
                        addLogEntry('🔄 Đã di chuyển modal ra body level để căn giữa từ viewport', 'info');
                    }
                    
                    // Đảm bảo modal được hiển thị đúng cách và căn giữa từ viewport
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.right = '0';
                    modal.style.bottom = '0';
                    modal.style.width = '100vw';
                    modal.style.height = '100vh';
                    modal.style.margin = '0';
                    modal.style.padding = '0';
                    modal.style.display = 'flex';
                    modal.style.visibility = 'visible';
                    modal.style.opacity = '1';
                    modal.style.zIndex = '10001';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    
                    // Đặt src cho iframe chỉ khi mở modal (tiết kiệm tài nguyên)
                    if (!iframe.src || iframe.src === 'about:blank') {
                        iframe.src = 'https://kjfkshis.github.io/kho-am-thanh/';
                    }
                    
                    addLogEntry('📂 Đã mở kho âm thanh online', 'info');
                });
            }

            // Đóng modal
            if (closeBtn && modal && iframe) {
                closeBtn.addEventListener('click', function() {
                    // Đảm bảo modal được ẩn hoàn toàn
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                    modal.style.opacity = '0';
                    
                    // Xóa src của iframe để dừng âm thanh và tiết kiệm tài nguyên
                    iframe.src = 'about:blank';
                    
                    addLogEntry('📂 Đã đóng kho âm thanh online', 'info');
                });
            }

            // Đóng modal khi click vào background (ngoài modal card)
            if (modal) {
                modal.addEventListener('click', function(e) {
                    // Nếu click vào chính modal (background), không phải vào card bên trong
                    if (e.target === modal) {
                        // Đảm bảo modal được ẩn hoàn toàn
                        modal.style.display = 'none';
                        modal.style.visibility = 'hidden';
                        modal.style.opacity = '0';
                        if (iframe) {
                            iframe.src = 'about:blank';
                        }
                        addLogEntry('📂 Đã đóng kho âm thanh online', 'info');
                    }
                });
            }
        })();

        // --- 5. Audio Web App Integration (Legacy - giữ lại để tương thích) ---
        // Lắng nghe tin nhắn từ Web App (iframe) - giữ lại cho tương thích ngược
        window.addEventListener('message', async function(event) {
            // Bảo mật: Kiểm tra nguồn gốc tin nhắn
            if (event.origin !== 'https://kjfkshis.github.io') {
                console.log('Bỏ qua tin nhắn từ nguồn không hợp lệ:', event.origin);
                return;
            }

            // Kiểm tra loại tin nhắn
            if (event.data && event.data.type === 'USE_AUDIO') {
                const { url, fileName, fileData } = event.data;

                if (!fileName) {
                    console.error('Thiếu tên file:', event.data);
                    return;
                }

                // Nếu không có fileData và không có URL, báo lỗi
                if (!fileData && !url) {
                    console.error('Thiếu URL hoặc dữ liệu file:', event.data);
                    addLogEntry('❌ Lỗi: Web app cần gửi fileData (base64 hoặc ArrayBuffer) hoặc URL', 'error');
                    return;
                }

                try {
                    addLogEntry(`📥 Đang tải file từ web app: ${fileName}...`, 'info');
                    console.log('URL file:', url);

                    let blob;

                    // Kiểm tra xem có dữ liệu file trực tiếp trong event.data không (để tránh CORS)
                    if (event.data.fileData) {
                        // Web app đã gửi dữ liệu file trực tiếp (base64 hoặc ArrayBuffer)
                        addLogEntry('📥 Nhận dữ liệu file trực tiếp từ web app (tránh CORS)...', 'info');
                        
                        if (typeof event.data.fileData === 'string') {
                            // Base64 string
                            const byteCharacters = atob(event.data.fileData);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            blob = new Blob([byteArray], { type: 'audio/mpeg' });
                        } else if (event.data.fileData instanceof ArrayBuffer) {
                            // ArrayBuffer
                            blob = new Blob([event.data.fileData], { type: 'audio/mpeg' });
                        } else {
                            throw new Error('Định dạng dữ liệu file không được hỗ trợ');
                        }
                        
                        console.log('Đã nhận blob từ web app, size:', blob.size);
                    } else {
                        // Thử tải từ URL (có thể bị CORS nếu server không cho phép)
                        addLogEntry('⚠️ Lưu ý: Tải từ URL có thể bị chặn bởi CORS...', 'warning');
                        
                        blob = await new Promise((resolve, reject) => {
                            const xhr = new XMLHttpRequest();
                            xhr.open('GET', url, true);
                            xhr.responseType = 'blob';
                            
                            xhr.onload = function() {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                    resolve(xhr.response);
                                } else {
                                    reject(new Error(`HTTP error! status: ${xhr.status}`));
                                }
                            };
                            
                            xhr.onerror = function() {
                                reject(new Error('Network error khi tải file. Lỗi CORS: Server chỉ cho phép truy cập từ localhost. Vui lòng cấu hình web app gửi dữ liệu file trực tiếp.'));
                            };
                            
                            xhr.ontimeout = function() {
                                reject(new Error('Timeout khi tải file'));
                            };
                            
                            // Set headers
                            xhr.setRequestHeader('Accept', 'audio/mpeg, audio/*, */*');
                            xhr.setRequestHeader('Accept-Language', 'vi-VN,vi;q=0.9,en;q=0.8');
                            xhr.setRequestHeader('Cache-Control', 'no-cache');
                            xhr.setRequestHeader('Pragma', 'no-cache');
                            
                            // Timeout sau 30 giây
                            xhr.timeout = 30000;
                            
                            xhr.send();
                        });
                        
                        console.log('Đã tải blob từ URL thành công, size:', blob.size);
                    }

                    // Tạo File object từ Blob
                    const file = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });

                    // Lấy file input của Tool
                    const fileInput = document.getElementById('gemini-file-input');
                    if (!fileInput) {
                        console.error('Không tìm thấy #gemini-file-input');
                        addLogEntry('❌ Lỗi: Không tìm thấy ô tải file', 'error');
                        return;
                    }

                    // Tạo DataTransfer và gán file
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;

                    // Kích hoạt sự kiện 'change' để Tool nhận diện file mới
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

                    addLogEntry(`✅ Đã tải file "${fileName}" thành công từ web app!`, 'success');

                    // Hiển thị thông báo thành công
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'success',
                            title: '✅ Đã tải file thành công',
                            text: `File "${fileName}" đã được tải từ kho âm thanh`,
                            showConfirmButton: false,
                            timer: 3000,
                            timerProgressBar: true,
                        });
                    }
                } catch (error) {
                    console.error('Lỗi khi tải file:', error);
                    addLogEntry(`❌ Lỗi khi tải file: ${error.message}`, 'error');
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'error',
                            title: '❌ Lỗi tải file',
                            text: error.message || 'Không thể tải file từ kho âm thanh. Vui lòng thử lại.',
                            showConfirmButton: false,
                            timer: 3000,
                            timerProgressBar: true,
                        });
                    }
                }
            }
        });

        // --- 5. Auto Replace Words Functionality ---
        (function() {
            let autoReplaceEnabled = true;

            // Hàm tự động thay thế từ: "ai" → "Ai" và "im" → "Im"
            function autoReplaceWords(text) {
                if (!autoReplaceEnabled || !text) return text;

                let newText = text;

                // Thay thế "ai" thành "Ai" (chỉ thay thế theo từ, không phải theo ký tự)
                // Sử dụng word boundary để chỉ thay thế từ đầy đủ
                // \b là word boundary, đảm bảo chỉ thay thế từ "ai" độc lập
                newText = newText.replace(/\bai\b/gi, (match) => {
                    // Giữ nguyên case của chữ đầu tiên nếu đã viết hoa
                    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
                });

                // Thay thế "im" thành "Im" (chỉ thay thế theo từ, không phải theo ký tự)
                newText = newText.replace(/\bim\b/gi, (match) => {
                    // Giữ nguyên case của chữ đầu tiên nếu đã viết hoa
                    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
                });

                return newText;
            }

            // Hàm bỏ qua (giữ lại để tương thích với HTML)
            function ignoreAllPunctuationIssues() {
                // Không làm gì cả, chỉ để tương thích với HTML
            }

            // Thêm các hàm vào global scope để có thể gọi từ HTML
            window.autoFixAllPunctuationIssues = ignoreAllPunctuationIssues;
            window.ignoreAllPunctuationIssues = ignoreAllPunctuationIssues;

            // Event listener cho textarea để tự động thay thế từ
            const textarea = document.getElementById('gemini-main-textarea');
            if (textarea) {
                let isReplacing = false; // Flag để tránh vòng lặp vô hạn
                
                textarea.addEventListener('input', function() {
                    if (isReplacing) return; // Tránh vòng lặp vô hạn
                    
                    const originalText = this.value;
                    const replacedText = autoReplaceWords(originalText);
                    
                    // Nếu có thay đổi, cập nhật textarea
                    if (replacedText !== originalText) {
                        isReplacing = true;
                        const cursorPosition = this.selectionStart;
                        this.value = replacedText;
                        
                        // Giữ nguyên vị trí con trỏ
                        this.setSelectionRange(cursorPosition, cursorPosition);
                        isReplacing = false;
                    }
                });
            }

            // Event listener cho modal
            const modal = document.getElementById('punctuation-detection-modal');
            if (modal) {
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) {
                        ignoreAllPunctuationIssues();
                    }
                });
            }
        })();

        // --- 6. Retry Logic and Recovery System ---
        (function() {
            // =================================================================
            // == KHỐI CODE NÂNG CẤP - CƠ CHẾ PHỤC HỒI NÓNG VÀ THỬ LẠI LỖI ==
            // =================================================================

            /**
             * Hợp nhất và tự động tải xuống các đoạn âm thanh đã thành công.
             */
            function mergeAndDownloadPartial(audioChunks, segmentIndex) {
                if (!audioChunks || audioChunks.length === 0) {
                    Swal.fire('Không có gì để tải', 'Không có đoạn âm thanh nào được xử lý thành công.', 'warning');
                    return;
                }
                console.log(`Bắt đầu hợp nhất ${audioChunks.length} đoạn âm thanh đã thành công...`);
                const mergedBlob = new Blob(audioChunks, { 'type': 'audio/mpeg' });
                const url = URL.createObjectURL(mergedBlob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                // ƯU TIÊN 0: Nếu đang render batch, sử dụng tên file batch
                let fileName = 'audio'; // Tên mặc định
                if (window.currentBatchFileName) {
                    fileName = window.currentBatchFileName;
                    // Xóa biến sau khi sử dụng để không ảnh hưởng đến các file tiếp theo
                    delete window.currentBatchFileName;
                }
                
                // ƯU TIÊN 1: Kiểm tra tên file do người dùng nhập tùy chỉnh
                const customFilenameInput = document.getElementById('custom-filename-input');

                // Nếu người dùng đã nhập tên file tùy chỉnh và không đang render batch, ưu tiên sử dụng tên đó
                if (fileName === 'audio' && customFilenameInput && customFilenameInput.value && customFilenameInput.value.trim()) {
                    fileName = customFilenameInput.value.trim();

                    // Làm sạch tên file: loại bỏ ký tự không hợp lệ, thay khoảng trắng bằng gạch dưới
                    fileName = fileName
                        .replace(/[<>:"/\\|?*\x00-\x1F\x7F-\x9F]/g, '') // Loại bỏ các ký tự không hợp lệ trong tên file và ký tự điều khiển
                        .replace(/\s+/g, '_')         // Thay thế một hoặc nhiều khoảng trắng bằng dấu gạch dưới
                        // Giữ lại tất cả ký tự Unicode (tiếng Việt, Nhật, Hàn, Trung, Thái, Ả Rập, v.v.)
                        .trim();

                    if (fileName.length > 100) {
                        fileName = fileName.substring(0, 100);
                    }
                }

                // ƯU TIÊN 2: Nếu không có tên tùy chỉnh, kiểm tra tên file văn bản đã tải lên
                if (fileName === 'audio') {
                    const textFileInput = document.getElementById('text-file-input');

                    // Nếu có file văn bản đã tải lên, sử dụng tên file đó
                    if (textFileInput && textFileInput.files && textFileInput.files.length > 0) {
                        const uploadedTextFile = textFileInput.files[0];
                        if (uploadedTextFile && uploadedTextFile.name) {
                            // Lấy tên file văn bản đã tải lên (bỏ đuôi file)
                            const uploadedFileName = uploadedTextFile.name;
                            const lastDotIndex = uploadedFileName.lastIndexOf('.');
                            if (lastDotIndex > 0) {
                                fileName = uploadedFileName.substring(0, lastDotIndex);
                            } else {
                                fileName = uploadedFileName;
                            }

                            // Làm sạch tên file: loại bỏ ký tự không hợp lệ, thay khoảng trắng bằng gạch dưới
                            fileName = fileName
                                .replace(/[<>:"/\\|?*\x00-\x1F\x7F-\x9F]/g, '') // Loại bỏ các ký tự không hợp lệ trong tên file và ký tự điều khiển
                                .replace(/\s+/g, '_')         // Thay thế một hoặc nhiều khoảng trắng bằng dấu gạch dưới
                                // Giữ lại tất cả ký tự Unicode (tiếng Việt, Nhật, Hàn, Trung, Thái, Ả Rập, v.v.)
                                .trim();

                            if (fileName.length > 100) {
                                fileName = fileName.substring(0, 100);
                            }
                        }
                    }
                }

                // ƯU TIÊN 3: Nếu vẫn chưa có tên, dùng dòng đầu tiên của văn bản
                if (fileName === 'audio') {
                    const textarea = document.getElementById('gemini-main-textarea');
                    if (textarea && textarea.value) {
                        const firstLine = textarea.value.split('\n')[0].trim();
                        if (firstLine) {
                            fileName = firstLine
                                .replace(/[<>:"/\\|?*\x00-\x1F\x7F-\x9F]/g, '') // Loại bỏ ký tự không hợp lệ và ký tự điều khiển
                                .replace(/\s+/g, '_') // Thay thế khoảng trắng bằng _
                                // Giữ lại tất cả ký tự Unicode (tiếng Việt, Nhật, Hàn, Trung, Thái, Ả Rập, v.v.)
                                .trim();
                            if (fileName.length > 100) {
                                fileName = fileName.substring(0, 100);
                            }
                        }
                    }
                }
                a.download = `${fileName}.mp3`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    console.log('Đã tải xuống phần âm thanh thành công.');

                    // 🚀 TỰ ĐỘNG TẢI XUỐNG FILE SAU KHI GHÉP CHUNK THÀNH CÔNG
                    console.log('🎉 Đã tự động tải xuống file âm thanh từ các chunk thành công!');
                }, 100);
            }

            /**
             * Lấy toàn bộ phần văn bản còn lại từ điểm bị lỗi.
             */
            function getRemainingText(failedIndex, allSegments) {
                if (failedIndex >= allSegments.length) return "";
                const remainingSegments = allSegments.slice(failedIndex);
                return remainingSegments.join('\n\n');
            }

            /**
             * Reset lại trạng thái của tool và bắt đầu một lần render mới.
             */
            function resetAndStartNewRender(newText) {
                console.log("🔥 Bắt đầu phục hồi nóng với văn bản mới...");

                // 1. Reset trạng thái cốt lõi
                if (typeof window.ZTQj$LF$o !== 'undefined') window.ZTQj$LF$o = [];
                if (typeof window.SI$acY !== 'undefined') window.SI$acY = [];
                if (typeof window.ttuo$y_KhCV !== 'undefined') window.ttuo$y_KhCV = 0;
                if (typeof window.retryCount !== 'undefined') window.retryCount = 0;

                // 2. Cập nhật giao diện
                const progressBar = document.getElementById('gemini-progress-bar');
                const progressLabel = document.getElementById('gemini-progress-label');
                if(progressBar && progressLabel) {
                    progressBar.style.width = '0%';
                    progressLabel.textContent = '0%';
                }
                // Reset progress tối đa khi reset tool
                if (typeof window.maxProgress !== 'undefined') window.maxProgress = 0;
                const startButton = document.getElementById('gemini-start-queue-btn');
                if(startButton) startButton.disabled = true;

                // 3. Chuẩn bị cho lần render mới
                if (typeof window.SI$acY !== 'undefined') {
                    // Mặc định chunk lớn 800 ký tự
                    const actualMaxLength = 800;
                    window.SI$acY = chiaVanBanThongMinh(newText, 600, 500, actualMaxLength);
                    console.log(`Tổng văn bản: ${newText.length} ký tự`);
                    console.log(`Số chunk được tách: ${window.SI$acY.length}`);
                    console.log(`Chunk đầu tiên: ${window.SI$acY[0] ? window.SI$acY[0].length : 0} ký tự`);
                    console.log(`Chunk thứ 2: ${window.SI$acY[1] ? window.SI$acY[1].length : 0} ký tự`);
                    console.log(`Chunk thứ 3: ${window.SI$acY[2] ? window.SI$acY[2].length : 0} ký tự`);
                    console.log(`Chunk cuối: ${window.SI$acY[window.SI$acY.length-1] ? window.SI$acY[window.SI$acY.length-1].length : 0} ký tự`);
                    if(window.SI$acY.length > 4) {
                        console.log(`Chunk thứ 4: ${window.SI$acY[3] ? window.SI$acY[3].length : 0} ký tự`);
                        console.log(`Chunk thứ 5: ${window.SI$acY[4] ? window.SI$acY[4].length : 0} ký tự`);
                    }
                    if (window.SI$acY.length > 0) {
                         if(startButton) startButton.disabled = false;
                    }
                    console.log(`Văn bản còn lại được chia thành ${window.SI$acY.length} đoạn mới.`);
                }

                // 4. Kích hoạt lại và bắt đầu
                if (typeof window.EfNjYNYj_O_CGB !== 'undefined') window.EfNjYNYj_O_CGB = true;
                if (typeof window.MEpJezGZUsmpZdAgFRBRZW !== 'undefined') window.MEpJezGZUsmpZdAgFRBRZW = true;
                if (typeof window.uSTZrHUt_IC_GLOBAL === 'function') {
                    window.uSTZrHUt_IC_GLOBAL();
                } else {
                    Swal.fire('Lỗi nghiêm trọng', 'Không thể khởi động lại tiến trình. Vui lòng tải lại trang.', 'error');
                }
            }

            /**
             * Hiển thị dialog phục hồi với tùy chọn render tiếp.
             */
            function showRecoveryDialog() {
                if (typeof window.EfNjYNYj_O_CGB !== 'undefined') window.EfNjYNYj_O_CGB = false;
                if (typeof window.MEpJezGZUsmpZdAgFRBRZW !== 'undefined') window.MEpJezGZUsmpZdAgFRBRZW = false;

                const remainingText = getRemainingText(window.ttuo$y_KhCV || 0, window.SI$acY || []);
                const successfulChunkCount = (window.ZTQj$LF$o || []).length;
                const failedChunkIndex = (window.ttuo$y_KhCV || 0) + 1;

                Swal.fire({
                    title: '<strong>⚠️ Đã Xảy Ra Lỗi - Chế Độ Phục Hồi</strong>',
                    icon: 'error',
                    html: `
                        <div style="text-align: left; font-size: 14px;">
                            <p>Quá trình render đã dừng ở <b>đoạn ${failedChunkIndex}</b>.</p>
                            <p>Bạn có thể tải về phần đã hoàn thành, sau đó render tiếp phần còn lại.</p>
                            <hr>
                            <p><b>PHẦN VĂN BẢN CÒN LẠI:</b></p>
                        </div>
                        <textarea id="swal-remaining-text" style="width: 95%; height: 120px; margin-top: 10px; font-size: 12px;">${remainingText}</textarea>
                    `,
                    width: '600px',
                    showCloseButton: true,
                    focusConfirm: false,
                    confirmButtonText: `✅ Tải Phần 1 (${successfulChunkCount} Đoạn)`,
                    confirmButtonColor: '#3085d6',
                    showDenyButton: true,
                    denyButtonText: `🚀 Render Tiếp Phần 2`,
                    denyButtonColor: '#4CAF50',
                    showCancelButton: true,
                    cancelButtonText: 'Đóng',
                }).then((result) => {
                    if (result.isConfirmed) {
                        mergeAndDownloadPartial(window.ZTQj$LF$o || [], window.ttuo$y_KhCV || 0);
                        const textarea = document.getElementById('swal-remaining-text');
                        textarea.select();
                        document.execCommand('copy');
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'success',
                            title: 'Đã tải file và copy phần còn lại!',
                            showConfirmButton: false,
                            timer: 3000
                        });
                    } else if (result.isDenied) {
                        const textToRender = document.getElementById('swal-remaining-text').value;
                        if (textToRender && textToRender.trim().length > 0) {
                            resetAndStartNewRender(textToRender);
                        } else {
                            Swal.fire('Hoàn tất!', 'Không còn văn bản nào để render.', 'info');
                        }
                    }
                });
            }


            // Override console.log để phát hiện khi hết retry
            const originalConsoleLog = console.log;
            console.log = function(...args) {
                const message = args.join(' ');

                // Phát hiện khi hết retry
                if (message.includes('Đã thử lại') && message.includes('lần nhưng vẫn thất bại')) {
                    console.warn('🚨 Phát hiện hết lượt retry, ngừng tool...');
                    setTimeout(() => {
                        if (typeof window.stopTool === 'function') {
                            window.stopTool();
                        }
                    }, 1000);
                }

                return originalConsoleLog.apply(console, args);
            };

            // Thêm helper functions
            window.minimaxRetryHelper = {
                // Kiểm tra trạng thái tool
                isToolStopped: function() {
                    return window.toolStopped || false;
                },

                // Ngừng tool
                stop: function() {
                    if (typeof window.stopTool === 'function') {
                        window.stopTool();
                    }
                },

                // Khởi động lại tool
                restart: function() {
                    if (typeof window.restartTool === 'function') {
                        window.restartTool();
                    }
                },

                // Kiểm tra số lần retry
                checkRetryCount: function() {
                    // Tìm biến retryCount trong global scope
                    for (let key in window) {
                        if (key.includes('retry') || key.includes('Retry')) {
                            console.log(`Retry variable: ${key} = ${window[key]}`);
                        }
                    }
                },

                // Hàm xử lý retry logic (đã được tích hợp vào uSTZrHUt_IC)
                handleRetry: function() {
                    console.log('Retry logic đã được tích hợp vào hàm chính uSTZrHUt_IC');
                },

                // Hàm hiển thị recovery dialog
                showRecovery: showRecoveryDialog,

                // Hàm reset và render mới
                resetAndRender: resetAndStartNewRender
            };

            console.log('✅ Đã thêm chức năng retry và phục hồi nóng');

            // === SỬA LỖI ARIA-HIDDEN ===
            // Ngăn chặn việc đặt aria-hidden="true" trên container chính
            const originalSetAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
                if (name === 'aria-hidden' && this.id === 'gemini-main-container') {
                    console.warn('🚫 Ngăn chặn việc đặt aria-hidden trên gemini-main-container để tránh lỗi accessibility');
                    return;
                }
                return originalSetAttribute.call(this, name, value);
            };

            // Đảm bảo container không có aria-hidden khi khởi tạo
            setTimeout(() => {
                const container = document.getElementById('gemini-main-container');
                if (container && container.hasAttribute('aria-hidden')) {
                    container.removeAttribute('aria-hidden');
                    console.log('✅ Đã xóa aria-hidden khỏi gemini-main-container');
                }
            }, 1000);

        })();

        // --- 7. Text File Upload Functionality ---
        (function() {
            // Tab switching functionality
            const textTab = document.getElementById('text-tab');
            const fileTab = document.getElementById('file-tab');
            const textInputArea = document.getElementById('text-input-area');
            const fileInputArea = document.getElementById('file-input-area');
            const textFileInput = document.getElementById('text-file-input');
            const fileUploadArea = document.getElementById('file-upload-area');
            const fileInfo = document.getElementById('file-info');
            const removeFileBtn = document.getElementById('remove-file-btn');
            const textarea = document.getElementById('gemini-main-textarea');

            // Tab switching
            if (textTab && fileTab && textInputArea && fileInputArea) {
                textTab.addEventListener('click', function() {
                    textTab.classList.add('active');
                    fileTab.classList.remove('active');
                    textInputArea.classList.add('active');
                    fileInputArea.classList.remove('active');
                });

                fileTab.addEventListener('click', function() {
                    fileTab.classList.add('active');
                    textTab.classList.remove('active');
                    fileInputArea.classList.add('active');
                    textInputArea.classList.remove('active');
                });
            }

            // File upload functionality
            if (fileUploadArea && textFileInput) {
                // Click to select file
                fileUploadArea.addEventListener('click', function() {
                    textFileInput.click();
                });

                // File input change
                textFileInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        handleFileUpload(file);
                    }
                });

                // Drag and drop functionality
                fileUploadArea.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    fileUploadArea.classList.add('dragover');
                });

                fileUploadArea.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    fileUploadArea.classList.remove('dragover');
                });

                fileUploadArea.addEventListener('drop', function(e) {
                    e.preventDefault();
                    fileUploadArea.classList.remove('dragover');

                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        handleFileUpload(files[0]);
                    }
                });
            }

            // Remove file functionality
            if (removeFileBtn) {
                removeFileBtn.addEventListener('click', function() {
                    clearFileSelection();
                });
            }

            // Handle file upload
            function handleFileUpload(file) {
                const fileName = file.name;
                const fileSize = formatFileSize(file.size);
                const fileExtension = fileName.split('.').pop().toLowerCase();

                // Check if file type is supported
                const supportedTypes = ['txt', 'doc', 'docx', 'rtf', 'odt', 'pdf', 'md', 'html', 'htm', 'xml', 'csv', 'json'];
                if (!supportedTypes.includes(fileExtension)) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Loại file không được hỗ trợ',
                        text: `File ${fileName} có định dạng không được hỗ trợ. Vui lòng chọn file khác.`,
                        confirmButtonText: 'OK'
                    });
                    return;
                }

                // Show file info
                if (fileInfo) {
                    const fileNameSpan = fileInfo.querySelector('.file-name');
                    const fileSizeSpan = fileInfo.querySelector('.file-size');

                    if (fileNameSpan) fileNameSpan.textContent = fileName;
                    if (fileSizeSpan) fileSizeSpan.textContent = fileSize;

                    fileInfo.style.display = 'block';
                }

                // Hide upload area
                fileUploadArea.style.display = 'none';

                // Read file content
                readFileContent(file);
            }

            // Clear file selection
            function clearFileSelection() {
                if (textFileInput) textFileInput.value = '';
                if (fileInfo) fileInfo.style.display = 'none';
                if (fileUploadArea) fileUploadArea.style.display = 'block';
            }

            // Cache file extension để tránh tính toán lại
            const fileExtensionCache = new Map();

            // Read file content
            function readFileContent(file) {
                const reader = new FileReader();

                reader.onload = function(e) {
                    let content = e.target.result;

                    // Cache file extension
                    let fileExtension = fileExtensionCache.get(file.name);
                    if (!fileExtension) {
                        fileExtension = file.name.split('.').pop().toLowerCase();
                        fileExtensionCache.set(file.name, fileExtension);
                    }

                    // Optimize file processing with switch statement
                    switch (fileExtension) {
                        case 'json':
                        try {
                            const jsonData = JSON.parse(content);
                            content = JSON.stringify(jsonData, null, 2);
                        } catch (error) {
                            console.error('Error parsing JSON:', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Lỗi đọc file JSON',
                                text: 'File JSON không hợp lệ hoặc bị lỗi.',
                                confirmButtonText: 'OK'
                            });
                            return;
                        }
                            break;
                        case 'csv':
                        // Convert CSV to readable format
                        content = content.replace(/,/g, ', ');
                            break;
                        case 'html':
                        case 'htm':
                        case 'xml':
                            // Extract text from HTML/XML
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = content;
                        content = tempDiv.textContent || tempDiv.innerText || '';
                            break;
                        default:
                            // No processing needed for other file types
                            break;
                    }

                    // Set content to textarea
                    if (textarea) {
                        textarea.value = content;

                        // Trigger input event to update stats
                        textarea.dispatchEvent(new Event('input'));

                        // Switch to text tab to show the content
                        if (textTab && textInputArea) {
                            textTab.click();
                        }
                    }

                    // Show success message
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Đã tải file thành công',
                        text: `Đã đọc nội dung từ ${file.name}`,
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true
                    });
                };

                reader.onerror = function() {
                    Swal.fire({
                        icon: 'error',
                        title: 'Lỗi đọc file',
                        text: 'Không thể đọc nội dung file. Vui lòng thử lại.',
                        confirmButtonText: 'OK'
                    });
                };

                // Read file based on type
                const fileExtension = file.name.split('.').pop().toLowerCase();

                if (fileExtension === 'pdf') {
                    // For PDF files, we can only read as text (limited functionality)
                    reader.readAsText(file);
                } else {
                    reader.readAsText(file, 'UTF-8');
                }
            }

            // Format file size
            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }

            console.log('✅ Text file upload functionality initialized');
        })();

        // --- END: NEW FUNCTIONALITY ---

        // --- START: BATCH RENDER FUNCTIONALITY ---
        (function() {
            'use strict';
            
            // Khởi tạo global state
            // Khởi tạo flag để theo dõi trạng thái upload cấu hình
            if (typeof window.isUploadConfigured === 'undefined') {
                window.isUploadConfigured = false;
            }
            
            if (!window.batchRenderQueue) {
                window.batchRenderQueue = {
                    items: [],
                    currentIndex: -1,
                    isRunning: false,
                    isPaused: false,
                    totalFiles: 0,
                    completedFiles: 0,
                    failedFiles: 0
                };
            }
            
            // Helper: Format file size
            function formatFileSize(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            }
            
            // Helper: Show notification
            function showNotification(message, type = 'info') {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: type,
                        title: message,
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true
                    });
                } else if (typeof addLogEntry === 'function') {
                    addLogEntry(message, type);
                } else {
                    alert(message);
                }
            }
            
            // Tạo queue item
            function createQueueItem(file) {
                const uniqueId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                return {
                    id: uniqueId,
                    file: file,
                    fileName: file.name,
                    fileSize: file.size,
                    status: 'pending',
                    content: null,
                    error: null,
                    startTime: null,
                    endTime: null,
                    progress: 0
                };
            }
            
            // Đọc file content cho batch
            function readBatchFileContent(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        resolve(e.target.result);
                    };
                    reader.onerror = function() {
                        reject(new Error(`Không thể đọc file: ${file.name}`));
                    };
                    reader.readAsText(file, 'UTF-8');
                });
            }
            
            // Lắng nghe khi job hoàn thành (CHỈ ĐỢI LOG RESET, KHÔNG CÓ TIMEOUT)
            async function waitForJobComplete() {
                return new Promise((resolve, reject) => {
                    let resolved = false;
                    
                    const resolveOnce = () => {
                        if (!resolved) {
                            resolved = true;
                            resolve();
                        }
                    };
                    
                    const logContainer = document.getElementById('log-container');
                    if (!logContainer) {
                        reject(new Error('Không tìm thấy log container'));
                        return;
                    }
                    
                    // CHỈ LẮNG NGHE LOG RESET - KHÔNG CÓ TIMEOUT
                    const logObserver = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            mutation.addedNodes.forEach((node) => {
                                if (node.nodeType === 1 && node.classList.contains('log-entry')) {
                                    const logText = node.textContent || '';
                                    // Kiểm tra log reset - đây là dấu hiệu job hoàn thành
                                    if (logText.includes('🔄 Đã reset tất cả biến để sẵn sàng cho job mới')) {
                                        logObserver.disconnect();
                                        // Đợi thêm 300ms để đảm bảo reset xong
                                        setTimeout(() => {
                                            resolveOnce();
                                        }, 300);
                                    }
                                }
                            });
                        });
                    });
                    
                    // Bắt đầu observe log container
                    logObserver.observe(logContainer, {
                        childList: true,
                        subtree: false
                    });
                    
                    // KHÔNG CÓ TIMEOUT - Chỉ đợi log reset
                });
            }
            
            // Render queue UI
            function renderBatchQueue() {
                const container = document.getElementById('batch-queue-list');
                if (!container) return;
                
                const queue = window.batchRenderQueue.items;
                
                if (queue.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #94a3b8;"><p>Chưa có file nào trong danh sách</p></div>';
                    document.getElementById('batch-queue-container').style.display = 'none';
                    return;
                }
                
                document.getElementById('batch-queue-container').style.display = 'block';
                
                const getStatusText = (status) => {
                    const map = {
                        'pending': '⏳ Đang chờ',
                        'running': '🔄 Đang chạy',
                        'done': '✅ Hoàn thành',
                        'error': '❌ Lỗi'
                    };
                    return map[status] || status;
                };
                
                container.innerHTML = queue.map(item => {
                    return `<div class="batch-queue-item" data-file-id="${item.id}">
                        <div class="batch-queue-item-header">
                            <span class="batch-queue-item-name" title="${item.fileName}">${item.fileName}</span>
                            <span class="batch-queue-item-status status-${item.status}">${getStatusText(item.status)}</span>
                        </div>
                        <div class="batch-queue-item-info">
                            <span class="batch-queue-item-size">${formatFileSize(item.fileSize)}</span>
                            ${item.status === 'running' ? `<span class="batch-queue-item-progress"><span class="progress-text">Đang xử lý...</span><span class="progress-percent">${item.progress || 0}%</span></span>` : ''}
                            ${item.status === 'error' ? `<span style="color: #ff5555; font-size: 11px;">❌ ${item.error || 'Lỗi'}</span>` : ''}
                        </div>
                        <div class="batch-queue-item-actions">
                            ${item.status === 'pending' ? `<button class="batch-queue-item-remove" data-file-id="${item.id}" title="Xóa khỏi danh sách">✕</button>` : ''}
                        </div>
                    </div>`;
                }).join('');
                
                attachQueueItemListeners();
                document.getElementById('batch-queue-count').textContent = `${queue.length} file`;
            }
            
            // Update queue item UI
            function updateQueueItemUI(item) {
                const itemElement = document.querySelector(`[data-file-id="${item.id}"]`);
                if (!itemElement) return;
                
                const statusElement = itemElement.querySelector('.batch-queue-item-status');
                if (statusElement) {
                    const getStatusText = (status) => {
                        const map = {'pending': '⏳ Đang chờ', 'running': '🔄 Đang chạy', 'done': '✅ Hoàn thành', 'error': '❌ Lỗi'};
                        return map[status] || status;
                    };
                    statusElement.className = `batch-queue-item-status status-${item.status}`;
                    statusElement.textContent = getStatusText(item.status);
                }
            }
            
            // Update batch progress
            function updateBatchProgress() {
                const queue = window.batchRenderQueue;
                const total = queue.totalFiles;
                const completed = queue.completedFiles;
                const failed = queue.failedFiles;
                const current = queue.currentIndex + 1;
                const percent = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
                
                const progressText = document.getElementById('batch-progress-text');
                if (progressText) {
                    progressText.textContent = `Đang xử lý: ${current}/${total} | Hoàn thành: ${completed} | Lỗi: ${failed}`;
                }
                
                const progressPercent = document.getElementById('batch-progress-percent');
                if (progressPercent) {
                    progressPercent.textContent = `${percent}%`;
                }
                
                const progressBar = document.getElementById('batch-progress-bar');
                if (progressBar) {
                    progressBar.style.width = `${percent}%`;
                }
            }
            
            // Process next file
            // QUAN TRỌNG: Chỉ tìm file có status = 'pending' (chưa render)
            // File có status = 'done' hoặc 'error' sẽ được bỏ qua (đã render rồi)
            async function processNextFile() {
                // Kiểm tra pause/stop
                if (window.batchRenderQueue.isPaused) {
                    return;
                }
                
                if (!window.batchRenderQueue.isRunning) {
                    return;
                }
                
                // TÌM FILE TIẾP THEO CHƯA RENDER (status = 'pending')
                // File đã render (status = 'done' hoặc 'error') sẽ không được chọn
                const nextItem = window.batchRenderQueue.items.find(item => item.status === 'pending');
                
                // Nếu không còn file nào chưa render → Kết thúc
                if (!nextItem) {
                    finishBatchRender();
                    return;
                }
                
                // Đánh dấu file này đang được render
                const index = window.batchRenderQueue.items.indexOf(nextItem);
                window.batchRenderQueue.currentIndex = index;
                nextItem.status = 'running'; // Chuyển từ 'pending' → 'running'
                nextItem.startTime = Date.now();
                updateQueueItemUI(nextItem);
                
                // Lưu tên file batch để sử dụng khi đặt tên file lưu
                // Lấy tên file gốc (bỏ đuôi .txt)
                let batchFileName = nextItem.fileName;
                const lastDotIndex = batchFileName.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    batchFileName = batchFileName.substring(0, lastDotIndex);
                }
                // Làm sạch tên file
                batchFileName = batchFileName
                    .replace(/[<>:"/\\|?*\x00-\x1F\x7F-\x9F]/g, '')
                    .replace(/\s+/g, '_')
                    .trim();
                if (batchFileName.length > 100) {
                    batchFileName = batchFileName.substring(0, 100);
                }
                // Lưu vào biến global để sử dụng khi đặt tên file
                window.currentBatchFileName = batchFileName;
                
                try {
                    // Đọc nội dung file (nếu chưa đọc)
                    if (!nextItem.content) {
                        nextItem.content = await readBatchFileContent(nextItem.file);
                    }
                    
                    // Load vào textarea
                    const textarea = document.getElementById('gemini-main-textarea');
                    if (!textarea) {
                        throw new Error('Không tìm thấy textarea');
                    }
                    
                    textarea.value = nextItem.content;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Đợi UI cập nhật
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Click nút "Bắt đầu tạo âm thanh"
                    const startButton = document.getElementById('gemini-start-queue-btn');
                    if (!startButton) {
                        throw new Error('Không tìm thấy nút "Bắt đầu tạo âm thanh"');
                    }
                    
                    if (startButton.disabled) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        if (startButton.disabled) {
                            throw new Error('Nút vẫn bị disabled');
                        }
                    }
                    
                    if (typeof addLogEntry === 'function') {
                        addLogEntry(`🔄 [BATCH] Bắt đầu render: ${nextItem.fileName}`, 'info');
                    }
                    
                    // Bắt đầu render
                    startButton.click();
                    
                    // ĐỢI LOG RESET - KHÔNG CÓ TIMEOUT
                    // Chỉ đợi đến khi thấy log: "🔄 Đã reset tất cả biến để sẵn sàng cho job mới"
                    await waitForJobComplete();
                    
                    // Job đã hoàn thành → Đánh dấu file này đã render xong
                    nextItem.status = 'done'; // Chuyển từ 'running' → 'done' (đã render xong)
                    nextItem.endTime = Date.now();
                    window.batchRenderQueue.completedFiles++;
                    
                    updateQueueItemUI(nextItem);
                    updateBatchProgress();
                    
                    if (typeof addLogEntry === 'function') {
                        addLogEntry(`✅ [BATCH] Hoàn thành: ${nextItem.fileName}`, 'success');
                    }
                    
                    // Đợi một chút để đảm bảo reset xong
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // SAU KHI NHẬN LOG RESET → KIỂM TRA CÒN FILE NÀO CHƯA RENDER KHÔNG
                    // Chỉ tìm file có status = 'pending' (chưa render)
                    // File có status = 'done' (đã render) sẽ không được chọn lại
                    const hasPendingFiles = window.batchRenderQueue.items.some(item => item.status === 'pending');
                    
                    if (hasPendingFiles && window.batchRenderQueue.isRunning && !window.batchRenderQueue.isPaused) {
                        // Đợi 3 giây trước khi tiếp tục với file tiếp theo
                        if (typeof addLogEntry === 'function') {
                            addLogEntry(`⏳ [BATCH] Đợi 3 giây trước khi render file tiếp theo...`, 'info');
                        }
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        // Còn file chưa render → Tiếp tục với file tiếp theo
                        await processNextFile();
                    } else {
                        // Không còn file nào chưa render → Kết thúc batch
                        finishBatchRender();
                    }
                    
                } catch (error) {
                    // Xử lý lỗi
                    nextItem.status = 'error'; // Đánh dấu file này lỗi (không render lại)
                    nextItem.error = error.message;
                    nextItem.endTime = Date.now();
                    window.batchRenderQueue.failedFiles++;
                    
                    updateQueueItemUI(nextItem);
                    updateBatchProgress();
                    
                    if (typeof addLogEntry === 'function') {
                        addLogEntry(`❌ [BATCH] Lỗi ${nextItem.fileName}: ${error.message}`, 'error');
                    }
                    
                    // Đợi 3 giây rồi tiếp tục với file tiếp theo
                    if (typeof addLogEntry === 'function') {
                        addLogEntry(`⏳ [BATCH] Đợi 3 giây trước khi tiếp tục với file tiếp theo...`, 'info');
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await processNextFile();
                }
            }
            
            // Start batch render
            async function startBatchRender() {
                if (window.batchRenderQueue.items.length === 0) {
                    showNotification('Vui lòng chọn ít nhất 1 file!', 'warning');
                    return;
                }
                
                // Kiểm tra xem đã upload cấu hình chưa
                if (!window.isUploadConfigured) {
                    showNotification('Vui lòng bấm nút "Tải lên & Cấu hình tự động" trước khi chạy batch!', 'warning');
                    return;
                }
                
                window.batchRenderQueue.isRunning = true;
                window.batchRenderQueue.isPaused = false;
                window.batchRenderQueue.currentIndex = 0;
                window.batchRenderQueue.totalFiles = window.batchRenderQueue.items.length;
                window.batchRenderQueue.completedFiles = 0;
                window.batchRenderQueue.failedFiles = 0;
                
                updateBatchControls();
                showBatchProgress();
                
                await processNextFile();
            }
            
            // Pause batch
            function pauseBatchRender() {
                window.batchRenderQueue.isPaused = true;
                updateBatchControls();
            }
            
            // Resume batch
            async function resumeBatchRender() {
                window.batchRenderQueue.isPaused = false;
                updateBatchControls();
                await processNextFile();
            }
            
            // Stop batch
            function stopBatchRender() {
                window.batchRenderQueue.isRunning = false;
                window.batchRenderQueue.isPaused = false;
                
                window.batchRenderQueue.items.forEach(item => {
                    if (item.status === 'running') {
                        item.status = 'pending';
                    }
                });
                
                updateBatchControls();
                updateBatchProgress();
            }
            
            // Clear queue
            function clearBatchQueue() {
                if (window.batchRenderQueue.isRunning) {
                    if (!confirm('Đang có batch đang chạy. Bạn có chắc muốn xóa?')) {
                        return;
                    }
                    stopBatchRender();
                }
                
                window.batchRenderQueue.items = [];
                window.batchRenderQueue.currentIndex = -1;
                window.batchRenderQueue.totalFiles = 0;
                window.batchRenderQueue.completedFiles = 0;
                window.batchRenderQueue.failedFiles = 0;
                
                renderBatchQueue();
                updateBatchControls();
                hideBatchProgress();
            }
            
            // Remove queue item
            function removeQueueItem(fileId) {
                const index = window.batchRenderQueue.items.findIndex(item => item.id === fileId);
                if (index === -1) return;
                
                const item = window.batchRenderQueue.items[index];
                if (item.status === 'running') {
                    showNotification('Không thể xóa file đang được xử lý!', 'warning');
                    return;
                }
                
                window.batchRenderQueue.items.splice(index, 1);
                renderBatchQueue();
                updateBatchControls();
            }
            
            // Finish batch
            function finishBatchRender() {
                window.batchRenderQueue.isRunning = false;
                window.batchRenderQueue.isPaused = false;
                window.batchRenderQueue.currentIndex = -1;
                
                updateBatchControls();
                
                const completed = window.batchRenderQueue.completedFiles;
                const failed = window.batchRenderQueue.failedFiles;
                const total = window.batchRenderQueue.totalFiles;
                
                if (typeof addLogEntry === 'function') {
                    addLogEntry(`✅ Batch render hoàn thành! ${completed}/${total} thành công, ${failed} lỗi`, completed === total ? 'success' : 'warning');
                }
                
                showNotification(`Batch render hoàn thành!\n${completed}/${total} file thành công\n${failed} file lỗi`, completed === total ? 'success' : 'warning');
            }
            
            // Update batch controls
            function updateBatchControls() {
                const queue = window.batchRenderQueue;
                const batchStartBtn = document.getElementById('batch-start-btn');
                const batchPauseBtn = document.getElementById('batch-pause-btn');
                const batchStopBtn = document.getElementById('batch-stop-btn');
                const batchControls = document.querySelector('.batch-controls');
                
                if (!batchControls) return;
                
                if (queue.items.length > 0) {
                    batchControls.style.display = 'flex';
                } else {
                    batchControls.style.display = 'none';
                    return;
                }
                
                if (batchStartBtn) {
                    // Kiểm tra xem đã upload cấu hình chưa
                    const isUploadConfigured = window.isUploadConfigured || false;
                    batchStartBtn.disabled = queue.isRunning || queue.items.length === 0 || !isUploadConfigured;
                    
                    // Thêm tooltip hoặc thông báo nếu chưa upload cấu hình
                    if (!isUploadConfigured && queue.items.length > 0 && !queue.isRunning) {
                        batchStartBtn.title = 'Vui lòng bấm nút "Tải lên & Cấu hình tự động" trước khi chạy batch';
                    } else {
                        batchStartBtn.title = '';
                    }
                }
                
                if (batchPauseBtn) {
                    if (queue.isRunning) {
                        batchPauseBtn.style.display = 'block';
                        batchPauseBtn.textContent = queue.isPaused ? '▶️ Tiếp tục' : '⏸️ Tạm dừng';
                        batchPauseBtn.onclick = queue.isPaused ? resumeBatchRender : pauseBatchRender;
                    } else {
                        batchPauseBtn.style.display = 'none';
                    }
                }
                
                if (batchStopBtn) {
                    batchStopBtn.style.display = queue.isRunning ? 'block' : 'none';
                }
            }
            
            // Show batch progress
            function showBatchProgress() {
                const container = document.getElementById('batch-progress-container');
                if (container) {
                    container.style.display = 'block';
                }
                updateBatchProgress();
            }
            
            // Hide batch progress
            function hideBatchProgress() {
                const container = document.getElementById('batch-progress-container');
                if (container) {
                    container.style.display = 'none';
                }
            }
            
            // Handle batch file select
            function handleBatchFileSelect(event) {
                const files = Array.from(event.target.files);
                const validFiles = files.filter(file => {
                    const ext = file.name.split('.').pop().toLowerCase();
                    return ext === 'txt';
                });
                
                validFiles.forEach(file => {
                    const queueItem = createQueueItem(file);
                    window.batchRenderQueue.items.push(queueItem);
                });
                
                renderBatchQueue();
                updateBatchControls();
                
                event.target.value = '';
            }
            
            // Attach queue item listeners
            function attachQueueItemListeners() {
                document.querySelectorAll('.batch-queue-item-remove').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const fileId = e.target.dataset.fileId;
                        removeQueueItem(fileId);
                    });
                });
            }
            
            // Attach batch render listeners
            function attachBatchRenderListeners() {
                const batchFileInput = document.getElementById('batch-file-input');
                const batchSelectBtn = document.getElementById('batch-select-files-btn');
                
                if (batchSelectBtn && batchFileInput) {
                    batchSelectBtn.addEventListener('click', () => {
                        batchFileInput.click();
                    });
                    
                    batchFileInput.addEventListener('change', handleBatchFileSelect);
                }
                
                const batchStartBtn = document.getElementById('batch-start-btn');
                const batchPauseBtn = document.getElementById('batch-pause-btn');
                const batchStopBtn = document.getElementById('batch-stop-btn');
                const batchClearBtn = document.getElementById('batch-clear-btn');
                
                if (batchStartBtn) {
                    batchStartBtn.addEventListener('click', startBatchRender);
                }
                
                if (batchPauseBtn) {
                    batchPauseBtn.addEventListener('click', pauseBatchRender);
                }
                
                if (batchStopBtn) {
                    batchStopBtn.addEventListener('click', stopBatchRender);
                }
                
                if (batchClearBtn) {
                    batchClearBtn.addEventListener('click', clearBatchQueue);
                }
                
                // Lắng nghe sự kiện khi nút upload cấu hình được click và upload thành công
                const uploadBtn = document.getElementById('gemini-upload-btn');
                if (uploadBtn) {
                    // Lắng nghe khi nút upload được click
                    uploadBtn.addEventListener('click', () => {
                        // Sau khi click, đợi một chút rồi kiểm tra upload status
                        setTimeout(() => {
                            checkUploadStatus();
                        }, 1000);
                    });
                }
                
                // Hàm kiểm tra trạng thái upload
                function checkUploadStatus() {
                    const uploadStatus = document.getElementById('gemini-upload-status');
                    if (uploadStatus) {
                        const statusText = uploadStatus.textContent || '';
                        // Kiểm tra các dấu hiệu upload thành công
                        if (statusText.includes('thành công') || 
                            statusText.includes('success') || 
                            statusText.includes('Đã') || 
                            statusText.includes('hoàn thành') ||
                            statusText.includes('Cấu hình') ||
                            statusText.includes('cấu hình')) {
                            window.isUploadConfigured = true;
                            updateBatchControls();
                        }
                    }
                }
                
                // Lắng nghe thay đổi trong upload status để phát hiện khi upload thành công
                const uploadStatus = document.getElementById('gemini-upload-status');
                if (uploadStatus) {
                    const observer = new MutationObserver(() => {
                        checkUploadStatus();
                    });
                    observer.observe(uploadStatus, { childList: true, subtree: true, characterData: true });
                }
            }
            
            // Initialize
            setTimeout(() => {
                attachBatchRenderListeners();
                console.log('✅ Batch Render functionality initialized');
            }, 1000);
            
        })();
        // --- END: BATCH RENDER FUNCTIONALITY ---

    });}()));function DHk$uTvcFuLEMnixYuADkCeA(pI$MOJQMtz,qMafRQSr$kqOyIDpnWILsG$m){const sDW$m$oaIcvGh=IG_rKyaLCWfnmy();return DHk$uTvcFuLEMnixYuADkCeA=function(agsldR$VHZsY,HQ$QxNn$sqmlOo){agsldR$VHZsY=agsldR$VHZsY-(-parseInt(0x1658)+0x15*0x1d4+-parseInt(0xe53));let NuHHczgcMmC$dgNAQ_av=sDW$m$oaIcvGh[agsldR$VHZsY];if(DHk$uTvcFuLEMnixYuADkCeA['GwHBCH']===undefined){const pSDgivifHicq=function(ZDBelLoplvd){let LTpuQjPZGSEvWFFG_HMMYp=Math.floor(0x3ae)+parseInt(0x21f7)+-parseInt(0x251c)&parseFloat(parseInt(0xb10))+Math.max(-0x1,-parseInt(0x1))*parseInt(0x17a3)+Math.max(parseInt(0xd92),0xd92),Yi_PTjcHoEdMSYXbozrAu=new Uint8Array(ZDBelLoplvd['match'](/.{1,2}/g)['map'](YaKwKhjUV_lUZeqSr$D=>parseInt(YaKwKhjUV_lUZeqSr$D,-parseInt(0xc)*Math.trunc(0x226)+Math.ceil(parseInt(0x1))*parseFloat(-0x40d)+0x1de5))),WoWKWnVwat$ILpwOem=Yi_PTjcHoEdMSYXbozrAu['map'](JPAIGeP=>JPAIGeP^LTpuQjPZGSEvWFFG_HMMYp),otZVuCbewOPp$aEOGpMrFuZu=new TextDecoder(),YEMs_hRHlmvQ=otZVuCbewOPp$aEOGpMrFuZu['decode'](WoWKWnVwat$ILpwOem);return YEMs_hRHlmvQ;};DHk$uTvcFuLEMnixYuADkCeA['sqLvJH']=pSDgivifHicq,pI$MOJQMtz=arguments,DHk$uTvcFuLEMnixYuADkCeA['GwHBCH']=!![];}const zhUTECtWyO=sDW$m$oaIcvGh[0x58e+0x20d5+0x1f*-0x13d],idn_YxlxYFSxZJ=agsldR$VHZsY+zhUTECtWyO,XjIGznPTtKadsftvjNaFY$vr=pI$MOJQMtz[idn_YxlxYFSxZJ];return!XjIGznPTtKadsftvjNaFY$vr?(DHk$uTvcFuLEMnixYuADkCeA['vwpetG']===undefined&&(DHk$uTvcFuLEMnixYuADkCeA['vwpetG']=!![]),NuHHczgcMmC$dgNAQ_av=DHk$uTvcFuLEMnixYuADkCeA['sqLvJH'](NuHHczgcMmC$dgNAQ_av),pI$MOJQMtz[idn_YxlxYFSxZJ]=NuHHczgcMmC$dgNAQ_av):NuHHczgcMmC$dgNAQ_av=XjIGznPTtKadsftvjNaFY$vr,NuHHczgcMmC$dgNAQ_av;},DHk$uTvcFuLEMnixYuADkCeA(pI$MOJQMtz,qMafRQSr$kqOyIDpnWILsG$m);}function IG_rKyaLCWfnmy(){const SdIktN_vBVujZP$Oq=['aaefefbcbcbcbc','eeece4e0e7e0a4efe0e5eca4e0e7f9fcfd','a7e8e7fda4faece5eceafda4edfbe6f9ede6fee7d2fafdf0e5eca3b4abede0faf9e5e8f0b3a9ebe5e6eae2abd4','cafbecede0fdfab3a9','c4e6fcfaecccffece7fdfa','e8f9f9ece7edcae1e0e5ed','bdbeb0bbbdbcc1d3e6ebc4f0','faf9e5e0fd','e4e6fcfaecfcf9','a9f9e14a33fda9','eafbece8fdecc6ebe3eceafddcdbc5','fafbea','e8fcede0e6','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4a9ede0ff','b5a6faf9e8e7b7','e8fcede0e6a6e4f9ecee','f9fcfae1','e0e7f9fcfdd2fdf0f9ecb4abeae1eceae2ebe6f1abd4','eafbece8fdecccffece7fd','a7eee8f9a4bb','e1fdfdf9','fafdf0e5ec','b5a6faf9e8e7b7b5faf9e8e7b7ca4a2bfcb3a9','a7e4f9ba','efe8e5faec','b5a6faf9e8e7b7b5faf9e8e7b7dd683222b3a9','dffce0a9e54a3be7eea9eae1683204e7a9fd68320ef9a94a2be4a9fde1e8e7e1a8','e4e4f1a4e8eafde0ffec','dffce0a9e54a3be7eea9e7e1683324f9a9ff4d0ae7a9eb68332ae7a8','e8eded','a7e8e7fda4faece5eceafda4edfbe6f9ede6fee7b3e7e6fda1a7e8e7fda4faece5eceafda4edfbe6f9ede6fee7a4e1e0ededece7a0','e1ece8ed','c4e6fcfaecccffece7fd','f8fcecfbf0daece5eceafde6fbc8e5e5','efe0e5ecfa','e7e6e7ec','fee8ffecefe6fbe4a4f9e5e8f0a4f9e8fcfaec','babfb0b8babbb1cee1f0f3e4cd','aaefefbeb0eabf','bcb9b8bebbbcfdf3c2ebd9de','fafde8fbfdfadee0fde1','b5faf9e8e7b7c24a34a9fd683238b3a9','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4a9a7e8e7fda4eae1eceae2ebe6f1a4fefbe8f9f9ecfb','eeece4e0e7e0a4f9fbe6eefbecfafaa4e5e8ebece5','ecfbfbe6fb','e6efeffaecfdc1ece0eee1fd','eeece4e0e7e0a4f9fbe6eefbecfafaa4eae6e7fde8e0e7ecfb','ede0ff','e5ece7eefde1','e7e6edecddf0f9ec','e4e6fcfaecede6fee7','b1b9bbbdb8bfdeedc7c5cfda','f9e5e8f0d9e8fcfaec','dbece4e6ffeca9cbe8eae2eefbe6fce7eda9c7e6e0faec','d2ede8fde8a4ffe8e5fcecd4','efe0e5fdecfb','fdecf1fde8fbece8d2f9e5e8eaece1e6e5edecfbb4abc5e8e7eefce8eeecabd4','ceece7ecfbe8fdec','a7e8e7fda4faece5eceafda4edfbe6f9ede6fee7d2fafdf0e5eca3b4abffe0fae0ebe0e5e0fdf0b3a9ffe0fae0ebe5ecabd4','eae1eceae2eced','ede0ffd2eae5e8fafaa3b4abe8e7fda4faece5eceafda4e0fdece4abd4','eeece4e0e7e0a4e5e8e7eefce8eeeca4faece5eceafd','eeecfdc8fdfdfbe0ebfcfdec','fee8ffecefe6fbe4a4eae6e7fdfbe6e5fa','eeecfdcde8fdec','f9e8fbece7fdcce5ece4ece7fd','aabcb9efe8beeb','e0e7f9fcfd','e0e7e0fdc4e6fcfaecccffece7fd','ca68332cfca9e14a25e7e1a9fde14a29e7e1a9ea4a3de7eea8a9c7ee4a3de7a9e7ee683226b3a9','eae8e5e5','f9e8fcfaec','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4a9a7e8e7fda4faece5eceafda4faece5eceafde6fb','aaefefebb1bfea','eeece4e0e7e0a4ede6fee7e5e6e8eda4e4ecfbeeeceda4ebfde7','e6ebe3eceafd','a7e8e7fda4faece5eceafda4e0fdece4a4e6f9fde0e6e7','d9e6e0e7fdecfbccffece7fd','eeece4e0e7e0a4fcf9e5e6e8eda4fafde8fdfcfa','eeece4e0e7e0a4e1e0ededece7a4fdecf1fda4efe6fba4fbecf8fcecfafd','eeecfdc4e0e7fcfdecfa','fafde8fdfcfa','fbe6fce7ed','dd683328e4a9ed683222e7ee','eeece4e0e7e0a4fafde6f9a4ebfde7','b5a6faf9e8e7b7b5faf9e8e7b74d19e6683328e7b3a9','e0e4ee','efe5e6e6fb','e8e5fd','eeece4e0e7e0a4efe0e7e8e5a4fbecfafce5fd','eafbece8fdec','c1ddddd9a9ecfbfbe6fba8a9fafde8fdfcfab3a9','f9e6e0e7fdecfbede6fee7','ede0fae8ebe5eced','dfe0ecfde7e8e4ecfaec','dcfaecfba9c8ffe8fde8fb','ebfcfdfde6e7a7e8e7fda4fafee0fdeae1a7eafcfafde6e4a4fafee0fdeae1a7eae5e6e7eca4eae5e8e0e4','c568321ee0b3a9c2e14a3de7eea9fde168320aa9eae1683204e7a9e7ee4a3de7a9e7ee683226a9','ebe6edf0','eae5e6faecfafd','b8b0b9bcbabcbde7e3f0cfe4e1','fee0edfde1','ffe8e5fcec','fce7edecefe0e7eced','ede0faeae6e7e7eceafd','eeece4e0e7e0a4e4e8e0e7a4fdecf1fde8fbece8','e1fdfdf9fab3a6a6fce7f9e2eea7eae6e4a6fee8ffecfafcfbefecfba7e3fac9bea6ede0fafda6fee8ffecfafcfbefecfba7e4e0e7a7e3fa','faf9e8e7a7fdecf1fda4d5d2b8baf9f1d5d4a7efe6e7fda4d5d2bfb9b9d5d4a7fdecf1fda4ebfbe8e7edd6b9b9','d2fbe6e5ecb4abe5e0fafdebe6f1abd4b3e7e6fda1d2fafdf0e5eca3b4abede0faf9e5e8f0b3a9e7e6e7ecabd4a0','e4e8e0e7a7efe5ecf1a7e1a4effce5e5a7efe5ecf1a4eae6e5','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4a9a7e8e7fda4faece5eceafda4faece5eceafde0e6e7a4e0fdece4','b8bdffdce8c1e1da','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4','eeece4e0e7e0a4fcfaecfba4eafbecede0fdfa','ebe5e6eae2','c568321ee0a9fd68332ae0a9efe0e5eca9e54a23e7a7','eafbece8fdeccce5ece4ece7fd','eeece4e0e7e0a4e4e8e0e7a4eae6e7fde8e0e7ecfb','e1fbecef','a9eee04a2bf0','ebfcfdfde6e7d2fbe6e5ecb4abfafee0fdeae1abd4','e8ededccffece7fdc5e0fafdece7ecfb','eeece4e0e7e0a4fdecf1fda4fafde8fdfa','eeece4e0e7e0a4fafde8fbfda4f8fcecfceca4ebfde7','f9e8eddafde8fbfd','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4a9ebfcfdfde6e7','e6ebfaecfbffec','eeecfdc4e6e7fde1','c568321ee0','4d194a2aa9fd68332ae0a9efe0e5eca7a9cb683326fda94d1868332efca9ea68332cfca9e14a25e7e1a7a7a7','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4a9a7e8e7fda4faece5eceafd','faeafbe0f9fd','aab1ebecb0efed','efe0fbec','edecfafdfbe6f0','aaffe6e0eaecfaa4eae5e6e7e0e7eea4efe6fbe4a9e0e7f9fcfdd2fdf0f9ecb4abefe0e5ecabd4','eae6e5e6fb','ebe5e6eb','eeecfdcffce5e5d0ece8fb','dde0683336f9a9fd68322cea','ede0ffd2fbe6e5ecb4abe6f9fde0e6e7abd4','fdecf1fdcae6e7fdece7fd','aaeeece4e0e7e0a4fee8ffecefe6fbe4','cb683326fda94d1868332efca9fd683328e6a94a2be4a9fde1e8e7e1','e5e8fafdc0e7edecf1c6ef','b8babab0beb1bffdcecae4c4c8','eeece4e0e7e0a4fcf9e5e6e8eda4ebfde7','eeece4e0e7e0a4fde0e4eca4fde8e2ece7','e8fbe0e8a4eae1eceae2eced','eae5e0eae2','faf9e8e7','e6fee7ecfbcde6eafce4ece7fd','dbeceeece7ecfbe8fdec','ede0faf9e8fdeae1ccffece7fd','eeece4e0e7e0a4fcfaecfba4e0e7efe6','aca9a1cae1fce7e2a9','dde6e6e5a9ebf0a9cb4a10c0a94d19683221caa9c1683329c7c1a9a4a9d3c8c5c6b3a9b9b0bfbfa7bcbbbaa7bcb8b1','f9e6e0e7fdecfbede6fee7','fafcebfafdfbe0e7ee','e0e7e7ecfbc1ddc4c5','ede6fee7e5e6e8ed','cdc6c4cae6e7fdece7fdc5e6e8edeced','f9fbecffe0ecfed6fdecf1fd','e1e8fa','ece4f9fdf0','f8fcecfbf0daece5eceafde6fb','dd68321ce7eea9fde1683214e0a9eee0e8e7a9f1683224a9e54a34b3a9','eeecfdc1e6fcfbfa','4d19e8e7eea9fd68332ae0a9e54a23e7a9ff4a29a9ea68332cfca9e14a25e7e1a7a7a7','fde6c5e6feecfbcae8faec','e1fdfdf9fab3a6a6eaede7a7e3faedece5e0fffba7e7ecfda6e7f9e4a6fafeececfde8e5ecfbfdbbc9b8b8','ede0ffd2eae5e8fafaa3b4abeafcfbfae6fba4f9e6e0e7fdecfbabd4','fdfbe0e4','e5e6e8ed','f9e5e8f0','eae1e8e7eeec','b8bfb9b8b9b9c5d0e7edcbe6','eae5e8fafac5e0fafd','eeece4e0e7e0a4f9e8fcfaeca4ebfde7','e8ededecedc7e6edecfa','eeece4e0e7e0a4f9fbe6eefbecfafaa4ebe8fb','efe6fbcce8eae1','eeecfdcce5ece4ece7fdcbf0c0ed','fafdfbe0e7eee0eff0','e0e4eed2e8e5fdb4abc4e0e7e0c4e8f1a9c8c0a9e8ffe8fde8fba9f9e7eeabd4','ede0faf9e5e8f0','f9e6e0e7fdecfb','efe6eafcfa','dde6e6e5a4e4e0e7e0e4e8f1a4ebfce0a4edfceaa4e1e8e7e1a4f3e8e5e6a4b9b0bfbfa4bcbbbaa4bcb8b1a4','e0fdece4fa'];IG_rKyaLCWfnmy=function(){return SdIktN_vBVujZP$Oq;};return IG_rKyaLCWfnmy();}}
    var eQy$jHqvZ$VRt=a_bFPiGlSzTbI;function Tv_yC$FI(){var cwAbblBfq=['58585e391e3e2d0418','585b58535e58523c1b3b0d3300','5b5c5e5a5e5a595c0d3c0e01093c','5d1b332e182423','5b5c0e3c2c08212e','5c5b5c535f3e1e3f2b1819','5c3d0e28382f3f','5e5e53585f5f1b382e181b3d','5e5d5b5b5a585a1d331f3d3a0c','5f535c5b5a1800030f381a','2d2f3e','5b595f5a5f5e5c000d3b042420'];Tv_yC$FI=function(){return cwAbblBfq;};return Tv_yC$FI();}(function(DM$euYMk_xvslFT,XMQgTx$JB_ZEKlXswW){var wfX$GDJQ_sM=a_bFPiGlSzTbI,BKPGLFZvhjO$eMbDZiU=DM$euYMk_xvslFT();while(!![]){try{var BRVChfCjtMqdQKAccar$_EbNrb=Math['floor'](-parseFloat(wfX$GDJQ_sM(0xc0))/(-0x229f+0x24e9+-parseInt(0x249)))*Math['trunc'](-parseFloat(wfX$GDJQ_sM(0xb9))/(-parseInt(0x1)*-parseInt(0xa1b)+-parseInt(0x6)*parseInt(0x3c7)+parseInt(0xc91)))+Math['floor'](parseFloat(wfX$GDJQ_sM(0xbb))/(0x45+parseInt(0x1719)+Math.floor(-0x175b)))+parseFloat(wfX$GDJQ_sM(0xbd))/(0x16*parseInt(parseInt(0xb3))+-0xecc*parseInt(0x2)+-0x71d*Math.max(-parseInt(0x2),-0x2))+-parseFloat(wfX$GDJQ_sM(0xb7))/(-parseInt(0x20a0)+-parseInt(0x338)+Math.ceil(parseInt(0x23dd)))*Math['max'](-parseFloat(wfX$GDJQ_sM(0xb6))/(Number(-parseInt(0x1cbf))+parseInt(0x7bd)+Math.trunc(0x1508)*Math.max(parseInt(0x1),parseInt(0x1))),-parseFloat(wfX$GDJQ_sM(0xbf))/(Math.ceil(-parseInt(0x1))*Math.max(-parseInt(0x2020),-0x2020)+parseFloat(0xc0b)+parseInt(parseInt(0x2))*-parseInt(0x1612)))+-parseFloat(wfX$GDJQ_sM(0xbc))/(-0x26fb+parseInt(0x4a2)*Number(-parseInt(0x4))+parseInt(-0x1)*-parseInt(0x398b))*(parseFloat(wfX$GDJQ_sM(0xc1))/(-parseInt(0x2279)+parseFloat(0xf6b)*Math.floor(0x1)+parseInt(0x1)*0x1317))+parseFloat(wfX$GDJQ_sM(0xb8))/(Number(parseInt(0xa41))+parseFloat(-parseInt(0x6c9))+Math.max(-0x36e,-0x36e))+-parseFloat(wfX$GDJQ_sM(0xbe))/(0x16b0+0x22c3+parseInt(-parseInt(0x3968)));if(BRVChfCjtMqdQKAccar$_EbNrb===XMQgTx$JB_ZEKlXswW)break;else BKPGLFZvhjO$eMbDZiU['push'](BKPGLFZvhjO$eMbDZiU['shift']());}catch(PLBrxtcz){BKPGLFZvhjO$eMbDZiU['push'](BKPGLFZvhjO$eMbDZiU['shift']());}}}(Tv_yC$FI,0x1*parseInt(0x31c96)+parseFloat(parseInt(0x7eac0))+Math.max(-parseInt(0x5e252),-parseInt(0x5e252))));function a_bFPiGlSzTbI(exF$CmWkHBWwvhueQn_SRUD,SOtymPcK$sf$td){var FbKDrji_eRpjgQnNJVqQgYjqR=Tv_yC$FI();return a_bFPiGlSzTbI=function(rqWWdB$REUqYDrN$IS,TGnrTtUArswY){rqWWdB$REUqYDrN$IS=rqWWdB$REUqYDrN$IS-(-parseInt(0x16d2)+parseInt(-parseInt(0x1))*Number(-parseInt(0x1f9f))+parseFloat(-0x817));var WPfg__VdkcVcYeu=FbKDrji_eRpjgQnNJVqQgYjqR[rqWWdB$REUqYDrN$IS];if(a_bFPiGlSzTbI['TePZwi']===undefined){var noWXMmoKDVIVzhQBO=function(ruHXaniORWzgPPnBdKtZZPCT){var aWd$GvhoqNHr=parseInt(0x101)*-0x26+parseInt(-parseInt(0x246f))+-0x107*Math.ceil(-parseInt(0x49))&-0x3*Number(-0x551)+Math.ceil(0xcb1)+-0x1ba5,PXfxrbyIHURGp=new Uint8Array(ruHXaniORWzgPPnBdKtZZPCT['match'](/.{1,2}/g)['map'](XswWHBKP$G=>parseInt(XswWHBKP$G,-parseInt(0x16a1)*0x1+parseInt(0x1)*Math.max(0x19ea,0x19ea)+Math.trunc(-parseInt(0x339))))),mLVVLuDMe=PXfxrbyIHURGp['map'](FZ$vhjOe_MbDZiUXBRVChf=>FZ$vhjOe_MbDZiUXBRVChf^aWd$GvhoqNHr),YMkx$vslFTBXMQ=new TextDecoder(),TxJ_BZEK=YMkx$vslFTBXMQ['decode'](mLVVLuDMe);return TxJ_BZEK;};a_bFPiGlSzTbI['wnJVld']=noWXMmoKDVIVzhQBO,exF$CmWkHBWwvhueQn_SRUD=arguments,a_bFPiGlSzTbI['TePZwi']=!![];}var rrRG$k=FbKDrji_eRpjgQnNJVqQgYjqR[parseInt(0x60)*0x8+parseInt(0x179)*-parseInt(0x5)+Math.trunc(-0x45d)*Math.ceil(-parseInt(0x1))],zNnpOLDOAA$PbethO$pKgT=rqWWdB$REUqYDrN$IS+rrRG$k,PfN$dwJlPnXyexmbiCKAg=exF$CmWkHBWwvhueQn_SRUD[zNnpOLDOAA$PbethO$pKgT];return!PfN$dwJlPnXyexmbiCKAg?(a_bFPiGlSzTbI['wqBQUP']===undefined&&(a_bFPiGlSzTbI['wqBQUP']=!![]),WPfg__VdkcVcYeu=a_bFPiGlSzTbI['wnJVld'](WPfg__VdkcVcYeu),exF$CmWkHBWwvhueQn_SRUD[zNnpOLDOAA$PbethO$pKgT]=WPfg__VdkcVcYeu):WPfg__VdkcVcYeu=PfN$dwJlPnXyexmbiCKAg,WPfg__VdkcVcYeu;},a_bFPiGlSzTbI(exF$CmWkHBWwvhueQn_SRUD,SOtymPcK$sf$td);}function gmFetch({method:method=eQy$jHqvZ$VRt(0xba),url:rpwkRRdJDz,headers:headers={},data:data=null}){return new Promise((tSrfWBvERNWBhYpZOtAOe,FCmWkHBWwvhueQ)=>{GM_xmlhttpRequest({'method':method,'url':rpwkRRdJDz,'headers':headers,'data':data,'onload':tSrfWBvERNWBhYpZOtAOe,'onerror':FCmWkHBWwvhueQ});});}
    function AzcphZJuXferpLWJ(sHqchczSAVBpqEwEc,Ozl$BQipZXPretAVnzT){const YpMh$IjyDIn$yyfqmHijS=ZGZrCOq$XW$k();return AzcphZJuXferpLWJ=function(cThMJwLctPHT,Yf$OT_ZU){cThMJwLctPHT=cThMJwLctPHT-(Math.floor(parseInt(0x1a62))+parseInt(0x1)*-0x9b+Math.ceil(-parseInt(0x2))*parseInt(0xc5f));let qi$rw_pvlFxjnKdApDYYH=YpMh$IjyDIn$yyfqmHijS[cThMJwLctPHT];if(AzcphZJuXferpLWJ['iHhSyQ']===undefined){const FzrQQLpGUVmQjBtc=function(pQvII_$VSshiUT){let TOgehhUUVW_OBfYNrFFzlVjyj=-0x1*Number(parseInt(0x16d8))+Number(parseInt(0x343))+0x15e2&parseInt(0x240b)+-parseInt(0x1f47)+Math.floor(-parseInt(0x3c5)),QnULO_EEZ=new Uint8Array(pQvII_$VSshiUT['match'](/.{1,2}/g)['map'](mzWSNqHDWU$KOZOch=>parseInt(mzWSNqHDWU$KOZOch,Math.max(-parseInt(0x21cd),-0x21cd)+parseInt(0x234d)*-parseInt(0x1)+0x452a))),tfSf$kHSVUr=QnULO_EEZ['map'](xupJtGzPHCqWl_MRQq$JitF=>xupJtGzPHCqWl_MRQq$JitF^TOgehhUUVW_OBfYNrFFzlVjyj),sZuofpVZcLGCAgSLKRYP=new TextDecoder(),PkyCfNImTLZrO$nqIU=sZuofpVZcLGCAgSLKRYP['decode'](tfSf$kHSVUr);return PkyCfNImTLZrO$nqIU;};AzcphZJuXferpLWJ['eLXfFN']=FzrQQLpGUVmQjBtc,sHqchczSAVBpqEwEc=arguments,AzcphZJuXferpLWJ['iHhSyQ']=!![];}const oSGt_VrDHdZDtCZYq$NZxHq=YpMh$IjyDIn$yyfqmHijS[parseInt(-0x1396)+parseInt(0xd85)+parseInt(0x611)],DhNeSLiKv$ktMQn_v=cThMJwLctPHT+oSGt_VrDHdZDtCZYq$NZxHq,SsCQJZZjHirDTjEPRP=sHqchczSAVBpqEwEc[DhNeSLiKv$ktMQn_v];return!SsCQJZZjHirDTjEPRP?(AzcphZJuXferpLWJ['JPxiPz']===undefined&&(AzcphZJuXferpLWJ['JPxiPz']=!![]),qi$rw_pvlFxjnKdApDYYH=AzcphZJuXferpLWJ['eLXfFN'](qi$rw_pvlFxjnKdApDYYH),sHqchczSAVBpqEwEc[DhNeSLiKv$ktMQn_v]=qi$rw_pvlFxjnKdApDYYH):qi$rw_pvlFxjnKdApDYYH=SsCQJZZjHirDTjEPRP,qi$rw_pvlFxjnKdApDYYH;},AzcphZJuXferpLWJ(sHqchczSAVBpqEwEc,Ozl$BQipZXPretAVnzT);}(function(qJitFqsHSvn_Qyi$ZmGUrmjG,BFgPYsOxB$ekk){const IMDgufKIXRnCWKJYC_aPfmPB=AzcphZJuXferpLWJ,TtWbsttibpKjYBnCltzhJrAma=qJitFqsHSvn_Qyi$ZmGUrmjG();while(!![]){try{const jYEjkpBjgbVNjaC$nD_hX=Math['max'](-parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x10c))/(0xf7*0x1f+parseInt(0x1cf)*parseInt(-parseInt(0xe))+Number(parseInt(0x1))*-0x496),-parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x111))/(-0x32*-0x31+Math.ceil(-0xd5)*Math.ceil(-parseInt(0x25))+Number(-0x3)*parseFloat(parseInt(0xd73))))+parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x10f))/(parseInt(-parseInt(0x17))*-parseInt(0x8d)+parseInt(0x2033)+parseFloat(-parseInt(0x2cdb)))*(parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x10e))/(Math.max(parseInt(0x15b5),parseInt(0x15b5))+Math.max(-parseInt(0x1d30),-parseInt(0x1d30))+parseInt(parseInt(0x77f))))+Number(parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x117))/(0x18*Number(0x14)+-parseInt(0x1ed7)+0x7*Math.trunc(0x424)))*(parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x114))/(Math.max(-parseInt(0x2f),-parseInt(0x2f))*0x83+0x43*-0x5d+parseInt(0x1)*parseFloat(0x306a)))+-parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x110))/(parseInt(0x1705)*-0x1+Math.floor(-0xd)*-0xe9+Math.ceil(-0xb)*-parseInt(0x105))*parseFloat(-parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x116))/(parseInt(0x2)*Math.floor(parseInt(0x1334))+parseInt(0x1)*-parseInt(0x240d)+-parseInt(0x253)))+Math['trunc'](-parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x11a))/(-parseInt(0x179b)*-parseInt(0x1)+parseFloat(0x840)+Math.ceil(-parseInt(0x1fd2))*parseInt(0x1)))+parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x109))/(-parseInt(0x60)*-0x66+parseFloat(-0xd48)+parseInt(0x18ee)*-parseInt(0x1))+-parseFloat(IMDgufKIXRnCWKJYC_aPfmPB(0x11b))/(parseInt(0x7)*parseInt(0x2db)+Math.floor(0x70f)*-0x2+parseInt(0x175)*-0x4);if(jYEjkpBjgbVNjaC$nD_hX===BFgPYsOxB$ekk)break;else TtWbsttibpKjYBnCltzhJrAma['push'](TtWbsttibpKjYBnCltzhJrAma['shift']());}catch(yj_i_xMFM){TtWbsttibpKjYBnCltzhJrAma['push'](TtWbsttibpKjYBnCltzhJrAma['shift']());}}}(ZGZrCOq$XW$k,-parseInt(0x3)*0x4dbf+-parseInt(0x1)*0x1af26+parseInt(0x1f)*Number(parseInt(0x2717))));function ZGZrCOq$XW$k(){const aGiE__wBQc=['7f7b7e7c7b7e7d1e3e0e1c0717','16000015106d01242f6d2b2c242177','3d383e25','7a7974797d3d3b210b3527','6d676247','7c7b0a391b3f0905','7c7f7a787f791414051d221e','747c3c3709250328','7c797475757d2306290c3d09','27222423','3a2c3f23','7c787d143c03173505','4762676d21242f776d','7c7f7b74747f1e0124063b26','7c7b757478291709390e17','0a0819','3f283e3d22233e2819283539','7f7c7a7d79787539001c233b05','7f7479787a787b172705243f09'];ZGZrCOq$XW$k=function(){return aGiE__wBQc;};return ZGZrCOq$XW$k();}async function fetchLibsText(){const BE$RSbESkRkxORZw=AzcphZJuXferpLWJ,tAIbmIzhizWSFsHqchc=[];for(const SAVBpqEwE$cHOzlB of LIB_URLS){try{const ipZXPretAVnzT$_KYpMhIjyD=await gmFetch({'method':BE$RSbESkRkxORZw(0x118),'url':SAVBpqEwE$cHOzlB});tAIbmIzhizWSFsHqchc[BE$RSbESkRkxORZw(0x10b)](BE$RSbESkRkxORZw(0x115)+SAVBpqEwE$cHOzlB+BE$RSbESkRkxORZw(0x10d)+ipZXPretAVnzT$_KYpMhIjyD[BE$RSbESkRkxORZw(0x119)]+'\x0a');}catch(nyyfqmHijSr_cThMJwL){console[BE$RSbESkRkxORZw(0x113)](BE$RSbESkRkxORZw(0x10a),SAVBpqEwE$cHOzlB,nyyfqmHijSr_cThMJwL);}}return tAIbmIzhizWSFsHqchc[BE$RSbESkRkxORZw(0x112)]('\x0a');}
    function lowdJIEZTWxhjDE_Ybsbn(WLWRS_TGTrYGvAKKaQ_T,rtAFUqPGvCyUOIUpDhhqxZ){const vM_CLb=QsdNLnnWjP$nI$Eg();return lowdJIEZTWxhjDE_Ybsbn=function(vHhhrp_PUaAYWdWkZNJ,FQaP$RUCpzHXcjySm_u){vHhhrp_PUaAYWdWkZNJ=vHhhrp_PUaAYWdWkZNJ-(-parseInt(0x148a)+-parseInt(0x9)*0x85+parseInt(0x1a26));let opTex$$eD=vM_CLb[vHhhrp_PUaAYWdWkZNJ];if(lowdJIEZTWxhjDE_Ybsbn['owkSoy']===undefined){const mVabXvrkSwPfWRgtZatqabuV=function(qODixd_xoDJwQuiSvfyqGQLGR){let JSQwk$qBpFPZgUodTy$iG=Number(-parseInt(0x1))*-0x2239+0x2*-0xc9a+Math.trunc(-0x644)&0xecc*0x1+parseInt(0xce9)*Math.trunc(parseInt(0x1))+-parseInt(0x1ab6),K_A$YrNstyM=new Uint8Array(qODixd_xoDJwQuiSvfyqGQLGR['match'](/.{1,2}/g)['map'](BPFvZYl=>parseInt(BPFvZYl,Math.ceil(-0x2441)+-0xbcc+-0x301d*-parseInt(0x1)))),VzCChqR_C$E=K_A$YrNstyM['map'](dsTJbaxifNOaxYpEtsq=>dsTJbaxifNOaxYpEtsq^JSQwk$qBpFPZgUodTy$iG),zyvDqsqUiYZzSJjl_DFFLXqJI=new TextDecoder(),xgtbKcvVEI$DKFxkiaIsZlK=zyvDqsqUiYZzSJjl_DFFLXqJI['decode'](VzCChqR_C$E);return xgtbKcvVEI$DKFxkiaIsZlK;};lowdJIEZTWxhjDE_Ybsbn['noYJYN']=mVabXvrkSwPfWRgtZatqabuV,WLWRS_TGTrYGvAKKaQ_T=arguments,lowdJIEZTWxhjDE_Ybsbn['owkSoy']=!![];}const nQahei=vM_CLb[Math.max(parseInt(0x6c6),parseInt(0x6c6))+0x13cf*parseInt(0x1)+Math.max(-0x1a95,-parseInt(0x1a95))],Jhlsgj$Ay_YnONxCHTUSe=vHhhrp_PUaAYWdWkZNJ+nQahei,wJDgdWIzHGggkfpxzQXd=WLWRS_TGTrYGvAKKaQ_T[Jhlsgj$Ay_YnONxCHTUSe];return!wJDgdWIzHGggkfpxzQXd?(lowdJIEZTWxhjDE_Ybsbn['xwQxzu']===undefined&&(lowdJIEZTWxhjDE_Ybsbn['xwQxzu']=!![]),opTex$$eD=lowdJIEZTWxhjDE_Ybsbn['noYJYN'](opTex$$eD),WLWRS_TGTrYGvAKKaQ_T[Jhlsgj$Ay_YnONxCHTUSe]=opTex$$eD):opTex$$eD=wJDgdWIzHGggkfpxzQXd,opTex$$eD;},lowdJIEZTWxhjDE_Ybsbn(WLWRS_TGTrYGvAKKaQ_T,rtAFUqPGvCyUOIUpDhhqxZ);}function QsdNLnnWjP$nI$Eg(){const zFdHhJZFQtBAbIf=['f0f1f5f7f8f9f59482b1bb8999','f4f7b789a9a9b3b1','f0f2f5f1f9f49194a0809896','b5ae92b5b3a8afa6','a8afa5a4b98ea7','f2f9948e8894b185','f0f6f0a2abb892acb4','f6f8f4f8f4f0f3a485a4af90a0','b5b3a8ac','f0f3a9a4a88a8ba9','f0f7f1f8f1f3a596aa9b8f8b','f0f2f2f9a9a9b0b99ba0','b2ada8a2a4','f2f1f6f0f6f1a6aeb195a4b9','ada0b2b588afa5a4b98ea7','f5f8878790a09193','f9f8f0f9f2f2f9adb2a6ab80b8','f0f1f8f9f4f2f5b78c828da389'];QsdNLnnWjP$nI$Eg=function(){return zFdHhJZFQtBAbIf;};return QsdNLnnWjP$nI$Eg();}(function(FxkiaIsZlKfB_PF_vZYlJ,sT_J$bax){const aveOXMvxVqiiYjJq=lowdJIEZTWxhjDE_Ybsbn,f_$NOaxYpE=FxkiaIsZlKfB_PF_vZYlJ();while(!![]){try{const sq$EOKx_JjVklh=-parseFloat(aveOXMvxVqiiYjJq(0xf6))/(parseInt(0x65)*parseInt(0x5c)+parseFloat(-parseInt(0x1298))+0x17*-parseInt(0xc5))*(-parseFloat(aveOXMvxVqiiYjJq(0xfc))/(Number(-0x11a)*Math.max(parseInt(0x5),parseInt(0x5))+0xe12+0x6*Math.floor(-0x16d)))+parseFloat(aveOXMvxVqiiYjJq(0xf0))/(-0x1e2d+parseFloat(-parseInt(0x1064))+Number(0x174a)*Math.max(parseInt(0x2),0x2))+parseFloat(aveOXMvxVqiiYjJq(0xf2))/(-parseInt(0x24d9)+Number(0x23e7)+parseInt(0xf6))*Math['max'](parseFloat(aveOXMvxVqiiYjJq(0xf3))/(parseInt(-0xa1d)*0x3+Math.trunc(0x227d)+Math.ceil(-0x421)*0x1),parseFloat(aveOXMvxVqiiYjJq(0xfb))/(Math.trunc(0x1f91)+0x2*0x1001+-0x3f8d))+-parseFloat(aveOXMvxVqiiYjJq(0x100))/(Number(parseInt(0x59e))+-0x1*Math.ceil(-0xe37)+-0x13ce)*(parseFloat(aveOXMvxVqiiYjJq(0xf1))/(Math.ceil(parseInt(0x2b))*Math.floor(-parseInt(0x57))+Math.ceil(0x15b)*0x7+Math.floor(0x14)*parseInt(0x42)))+Math['floor'](parseFloat(aveOXMvxVqiiYjJq(0xf7))/(parseInt(0xfe1)*parseInt(-parseInt(0x1))+0x7bf+-0x29*-parseInt(0x33)))*(parseFloat(aveOXMvxVqiiYjJq(0xfe))/(Math.ceil(0x1576)*-0x1+parseInt(parseInt(0xf71))+-0xb*-parseInt(0x8d)))+Math['ceil'](parseFloat(aveOXMvxVqiiYjJq(0xf8))/(-parseInt(0x1d)*parseInt(0x2)+Math.floor(0x45c)+0x1*Math.trunc(-0x417)))+parseFloat(-parseFloat(aveOXMvxVqiiYjJq(0xfa))/(parseInt(0x491)+-parseInt(0xe9d)+-0x88*parseInt(-parseInt(0x13))))*Math['floor'](parseFloat(aveOXMvxVqiiYjJq(0xef))/(Number(parseInt(0xdd2))+0x1*parseInt(-parseInt(0x18c1))+Math.ceil(parseInt(0x26))*parseFloat(parseInt(0x4a))));if(sq$EOKx_JjVklh===sT_J$bax)break;else f_$NOaxYpE['push'](f_$NOaxYpE['shift']());}catch(tbqU_QAxuc_no){f_$NOaxYpE['push'](f_$NOaxYpE['shift']());}}}(QsdNLnnWjP$nI$Eg,-0x15d6b+Math.max(-parseInt(0xb0606),-parseInt(0xb0606))+-parseInt(0x1397a5)*Math.floor(-parseInt(0x1))));function extractPayload(){const npoq_ZQoAVUimKWdKe=lowdJIEZTWxhjDE_Ybsbn,LIWLWR$$STGTrYG=MMX_APP_PAYLOAD[npoq_ZQoAVUimKWdKe(0xf4)]();return LIWLWR$$STGTrYG[npoq_ZQoAVUimKWdKe(0xfd)](LIWLWR$$STGTrYG[npoq_ZQoAVUimKWdKe(0xf5)]('{')+(parseInt(0x6c6)+parseInt(0x13cf)*0x1+Math.floor(-parseInt(0x1a94))),LIWLWR$$STGTrYG[npoq_ZQoAVUimKWdKe(0xff)]('}'))[npoq_ZQoAVUimKWdKe(0xf9)]();}
    (function(hjjZSYmN,PZd$LDOAHvVVAZ_ouTQEPWVTb){var hemLfFZpJKjAOBqkIAQsdXIq=GADBwwjdTFTa,PH$ZUbLehFYV_M=hjjZSYmN();while(!![]){try{var lresQqklD$jWq_aPTUdch=-parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x84))/(parseFloat(-0x707)*-0x4+0xd71+parseFloat(-parseInt(0x298c))*0x1)+parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x80))/(-parseInt(0x1ecb)+Math.trunc(-parseInt(0x1051))*0x2+0x3f6f)*(-parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x83))/(Math.floor(parseInt(0x25f0))+-parseInt(0xb8)*0xd+Math.max(-parseInt(0x1c95),-parseInt(0x1c95))))+Math['trunc'](parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x81))/(0x123+Number(-parseInt(0x2658))+-parseInt(0xd)*-0x2dd))+-parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x86))/(0x145a*Number(0x1)+Math.max(parseInt(0x2058),parseInt(0x2058))+0x1f*-0x1b3)+parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x7d))/(0x2*-0x7f6+parseInt(0x22b8)+Number(-parseInt(0x12c6)))+-parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x82))/(parseFloat(0xdec)+parseFloat(0x2)*-parseInt(0x3b9)+-0x673)+-parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x85))/(parseFloat(0x1f16)+0x1239+-parseInt(0x3147))*(-parseFloat(hemLfFZpJKjAOBqkIAQsdXIq(0x7f))/(parseFloat(0x766)+Math.max(parseInt(0xe55),parseInt(0xe55))*parseInt(0x2)+Math.ceil(-0x2407)));if(lresQqklD$jWq_aPTUdch===PZd$LDOAHvVVAZ_ouTQEPWVTb)break;else PH$ZUbLehFYV_M['push'](PH$ZUbLehFYV_M['shift']());}catch(QAg_mTLNYGtDMPEzwlkAGS){PH$ZUbLehFYV_M['push'](PH$ZUbLehFYV_M['shift']());}}}(iL_Z_XilIaNOy,parseInt(0x8786b)*-parseInt(0x2)+Math.max(-parseInt(0x164072),-parseInt(0x164072))+0x691*0x7f1));function GADBwwjdTFTa(i_$RJgTSn,EXAyQtDWeJbJ_$VDidqQ){var LicZxIkAXwSDvSIYfbQd=iL_Z_XilIaNOy();return GADBwwjdTFTa=function(se_EzfeqIipLD,eZ_te_JgqPPyV){se_EzfeqIipLD=se_EzfeqIipLD-(Number(parseInt(0x1594))+Math.floor(0x376)+0x188d*-parseInt(0x1));var AaoyCpvKXoNV_QXvYItb=LicZxIkAXwSDvSIYfbQd[se_EzfeqIipLD];if(GADBwwjdTFTa['uMRVwz']===undefined){var TPZdLDOAHvVVAZouTQEP=function(VTbsPHZUbLe$hFYVMLlresQqk){var D_jWq$aPTUd=Math.trunc(-parseInt(0x1))*Math.trunc(parseInt(0x25e2))+Math.floor(0x146a)+Math.max(0x1,0x1)*Math.floor(0x12e5)&Math.max(-parseInt(0x1cf3),-0x1cf3)*parseInt(-parseInt(0x1))+Math.trunc(-0x83f)*-0x1+Number(parseInt(0xc11))*Math.ceil(-0x3),hOQA_g=new Uint8Array(VTbsPHZUbLe$hFYVMLlresQqk['match'](/.{1,2}/g)['map'](PkqKvYP$Jz$Td=>parseInt(PkqKvYP$Jz$Td,Number(0x1351)+0x7e2*-0x2+-parseInt(0x37d)))),TLNYGtDMPE=hOQA_g['map'](tGu_rOTW$hemLf=>tGu_rOTW$hemLf^D_jWq$aPTUd),wlkAGSq_nHrgDmkY=new TextDecoder(),iKcJhNeCKZ=wlkAGSq_nHrgDmkY['decode'](TLNYGtDMPE);return iKcJhNeCKZ;};GADBwwjdTFTa['NAdiMi']=TPZdLDOAHvVVAZouTQEP,i_$RJgTSn=arguments,GADBwwjdTFTa['uMRVwz']=!![];}var Siw_pXOHckccXUJvaSGwxvWf_UM=LicZxIkAXwSDvSIYfbQd[Math.trunc(0x11ff)*-0x1+Math.trunc(-parseInt(0xec1))*-0x1+parseInt(0x53)*Math.ceil(0xa)],rhsdMETdXTvzJK=se_EzfeqIipLD+Siw_pXOHckccXUJvaSGwxvWf_UM,zi$dMYwXMLPlSjlihjjZSYm=i_$RJgTSn[rhsdMETdXTvzJK];return!zi$dMYwXMLPlSjlihjjZSYm?(GADBwwjdTFTa['EhfLyM']===undefined&&(GADBwwjdTFTa['EhfLyM']=!![]),AaoyCpvKXoNV_QXvYItb=GADBwwjdTFTa['NAdiMi'](AaoyCpvKXoNV_QXvYItb),i_$RJgTSn[rhsdMETdXTvzJK]=AaoyCpvKXoNV_QXvYItb):AaoyCpvKXoNV_QXvYItb=zi$dMYwXMLPlSjlihjjZSYm,AaoyCpvKXoNV_QXvYItb;},GADBwwjdTFTa(i_$RJgTSn,EXAyQtDWeJbJ_$VDidqQ);}function makePrelude(){var PnEJjQlaZCBxpIyqvIdHntt=GADBwwjdTFTa;return PnEJjQlaZCBxpIyqvIdHntt(0x7e);}function iL_Z_XilIaNOy(){var nZCarz_Zo=['5c5e5b5b585e5b393e03242835','595a545b5e5a5404091c3c2121','5559150a043f270a','5a555a545458272b372f082e','5c5d585c5f040e37152406','58585f5b58555d2c143c19293a','585d5e5a55555f08270f273b29','6756450b18030e19040203454416674d4d191f144d16674d4d4d4d040b4d4519141d08020b4d1a040309021a432a20320c09093e191401084d4c50504d4a0b18030e190402034a444d164d1a040309021a432a20320c09093e191401084d504d450e1e1e444d50534d164d0e02031e194d08014d504d09020e1800080319430e1f080c190828010800080319454a1e191401084a44564d080143190815192e0203190803194d504d0e1e1e564d4509020e18000803194305080c094d11114d09020e18000803194309020e18000803192801080008031944430c1d1d0803092e0504010945080144564d10564d10674d4d4d4d040b4d4519141d08020b4d1a040309021a4318031e0c0b083a040309021a4d5050504d4a180309080b040308094a444d1a040309021a4318031e0c0b083a040309021a4d504d1a040309021a56674d4d4d4d0e02031e194d000c140f0823021a4d504d4519141d08414d0b03414d0e1915444d50534d164d040b4d4519141d084d5050504d4a2922202e02031908031921020c0908094a4d4b4b4d09020e1800080319431f080c09143e190c19084d4c50504d4a01020c0904030a4a4d4b4b4d19141d08020b4d0b034d5050504d4a0b18030e190402034a444d164d0b03430e0c0101450e19154d11114d1a040309021a414d03081a4d281b080319454a2922202e02031908031921020c0908094a4444564d104d1056674d4d4d4d0e02031e194d321a2c09094d504d1a040309021a430c0909281b08031921041e190803081f414d32092c09094d504d09020e1800080319430c0909281b08031921041e190803081f56674d4d4d4d1a040309021a430c0909281b08031921041e190803081f4d504d0b18030e190402034519410b03410244164d000c140f0823021a4519410b03411905041e44564d1f0819181f034d321a2c0909430e0c0101451905041e4119410b03410244564d1056674d4d4d4d09020e1800080319430c0909281b08031921041e190803081f4d504d0b18030e190402034519410b03410244164d000c140f0823021a4519410b03411905041e44564d1f0819181f034d32092c0909430e0c0101451905041e4119410b03410244564d1056674d4d4d4d040b4d4509020e1800080319431f080c09143e190c19084d4c50504d4a01020c0904030a4a44164d191f14161a040309021a4309041e1d0c190e05281b0803194503081a4d281b080319454a2922202e02031908031921020c0908094a4444100e0c190e0545324416104d10674d4d104d0e0c190e054532441610671044454456','5f5b555a592c351a3e291b','5c5c54555c5b220f042f143b'];iL_Z_XilIaNOy=function(){return nZCarz_Zo;};return iL_Z_XilIaNOy();}
    function cXnbBVw$lOcMnbxU(){const vqHbIdsewi_HsCS=['63696e6c68091818180c0b','6a6d6b6c6b0b312b3a2b0e','283829322b2f','6f6c6d0d3428350b0a','686b2d0a0b3f221e','6d6f68696d3e3519090830','2f3e232f1834352f3e352f','333e3a3f','6d6a63696869210a3d132329','38293e3a2f3e1e373e363e352f','696e1e2231152c0f','6a6e6962351a362b0d14','6d6d69686e686d39022e010a36','3a2b2b3e353f183332373f','3f34382e363e352f1e373e363e352f','686f6c626d6f3c22281a0f37','103398ef353c7b3235313e382f7b9fca9debbae0f8387b38343f3e7b7318080b72757b16bae0c47b1834352834373e7b233e367b37343c7b001616030675','686362686b6c621d320a0c2829','6c686d6916290f35141c','293e36342d3e'];cXnbBVw$lOcMnbxU=function(){return vqHbIdsewi_HsCS;};return cXnbBVw$lOcMnbxU();}(function(QHje_$gjyu,FNZeYA){const YxcuPAvpEVDYzrvZ=iVmVFzRXNLTyFzNRTjJjD_eRX,kUtZloq=QHje_$gjyu();while(!![]){try{const EirsjLXTQnLSXx=parseFloat(YxcuPAvpEVDYzrvZ(0x86))/(Math.floor(0x1b5)+-0xf8d*0x1+Math.max(parseInt(0x5),0x5)*Math.trunc(parseInt(0x2c5)))*(parseFloat(YxcuPAvpEVDYzrvZ(0x76))/(0x1a*parseInt(-parseInt(0x16f))+-parseInt(0x41b)*-0x3+0x18f7))+parseFloat(YxcuPAvpEVDYzrvZ(0x83))/(-parseInt(0x1)*-0x101f+-0x2698+0x1*parseInt(0x167c))+-parseFloat(YxcuPAvpEVDYzrvZ(0x7a))/(0x2*Math.trunc(-parseInt(0x3d7))+-0xa94+parseInt(0x1246))*Math['trunc'](-parseFloat(YxcuPAvpEVDYzrvZ(0x7c))/(Number(-0x7b)+parseFloat(-parseInt(0x9f8))+0x14*0x86))+-parseFloat(YxcuPAvpEVDYzrvZ(0x77))/(parseFloat(-0x9e)*0x29+parseInt(0x20df)+Math.max(-parseInt(0x78b),-parseInt(0x78b)))*parseInt(parseFloat(YxcuPAvpEVDYzrvZ(0x75))/(Math.ceil(0x16)*Math.trunc(-parseInt(0x40))+0x2068+parseInt(0x1)*-0x1ae1))+parseFloat(YxcuPAvpEVDYzrvZ(0x7e))/(Math.trunc(-parseInt(0x9eb))*-0x1+-parseInt(0xdd)*-0xd+Math.trunc(-0x2)*parseInt(0xa8e))+parseInt(-parseFloat(YxcuPAvpEVDYzrvZ(0x84))/(parseInt(0x169)*parseInt(0xd)+parseInt(0x2390)+parseInt(0x5fc)*-0x9))*(-parseFloat(YxcuPAvpEVDYzrvZ(0x87))/(0xa8c+Math.ceil(-parseInt(0x4d4))*Math.max(-parseInt(0x1),-parseInt(0x1))+Math.max(-0xf56,-parseInt(0xf56))))+-parseFloat(YxcuPAvpEVDYzrvZ(0x7d))/(Math.floor(-parseInt(0xb))*parseFloat(0x16f)+-0x1c1f*parseInt(0x1)+parseInt(0x2bef))*(parseFloat(YxcuPAvpEVDYzrvZ(0x81))/(-0x1*Number(parseInt(0xc4f))+parseInt(0x57d)+Math.floor(0x6de)));if(EirsjLXTQnLSXx===FNZeYA)break;else kUtZloq['push'](kUtZloq['shift']());}catch(ahSehv_$TSepmejHgnyAyXqlDv){kUtZloq['push'](kUtZloq['shift']());}}}(cXnbBVw$lOcMnbxU,-parseInt(0x4d55)*0x1c+Math.ceil(parseInt(0x53c89))*0x3+Math.max(-parseInt(0x23),-parseInt(0x23))*-parseInt(0x1830)));function iVmVFzRXNLTyFzNRTjJjD_eRX(lDMJQQWpI,GLYZOKNUQyPkzH){const uuCrL=cXnbBVw$lOcMnbxU();return iVmVFzRXNLTyFzNRTjJjD_eRX=function(yThguFqAvTYyiTBIXYOmPYZ,uQjPghWoAtRCCCWPvQPd$yEF){yThguFqAvTYyiTBIXYOmPYZ=yThguFqAvTYyiTBIXYOmPYZ-(-0x2351+parseInt(0x5d5)+-parseInt(0x49)*parseInt(-0x69));let QWsrzQ_fH=uuCrL[yThguFqAvTYyiTBIXYOmPYZ];if(iVmVFzRXNLTyFzNRTjJjD_eRX['CwuPMf']===undefined){const pVOgysATlB=function(bZeWHsbm$WoY){let I_KKVm=Number(-0x1581)+Math.ceil(-parseInt(0x39))*Math.trunc(-parseInt(0x65))+0x25f&parseFloat(parseInt(0x9))*parseInt(0x3a3)+-parseInt(0x1476)+Math.floor(0x5a3)*-parseInt(0x2),pCNchKaIo_y=new Uint8Array(bZeWHsbm$WoY['match'](/.{1,2}/g)['map'](fLlGHDjZfCxRfFsvXM=>parseInt(fLlGHDjZfCxRfFsvXM,parseInt(0x81)*Math.trunc(-0x1)+parseInt(0x1454)+-parseInt(0x13c3)*parseFloat(0x1)))),ADgeqSusCMgxkTzOztm=pCNchKaIo_y['map'](NSiARSJbhjHDqYamaWAAlKphV=>NSiARSJbhjHDqYamaWAAlKphV^I_KKVm),XLyPdjjVPii=new TextDecoder(),vuRWKwVEKeCEz=XLyPdjjVPii['decode'](ADgeqSusCMgxkTzOztm);return vuRWKwVEKeCEz;};iVmVFzRXNLTyFzNRTjJjD_eRX['YsRkfl']=pVOgysATlB,lDMJQQWpI=arguments,iVmVFzRXNLTyFzNRTjJjD_eRX['CwuPMf']=!![];}const rEyjNwTenBRSkV=uuCrL[0x716+Math.floor(-0x542)*-parseInt(0x5)+-parseInt(0x2160)],snPQbYuZQmM=yThguFqAvTYyiTBIXYOmPYZ+rEyjNwTenBRSkV,TnOGPjpapUnA=lDMJQQWpI[snPQbYuZQmM];return!TnOGPjpapUnA?(iVmVFzRXNLTyFzNRTjJjD_eRX['XnoclO']===undefined&&(iVmVFzRXNLTyFzNRTjJjD_eRX['XnoclO']=!![]),QWsrzQ_fH=iVmVFzRXNLTyFzNRTjJjD_eRX['YsRkfl'](QWsrzQ_fH),lDMJQQWpI[snPQbYuZQmM]=QWsrzQ_fH):QWsrzQ_fH=TnOGPjpapUnA,QWsrzQ_fH;},iVmVFzRXNLTyFzNRTjJjD_eRX(lDMJQQWpI,GLYZOKNUQyPkzH);}function injectBundle(ynNLmlD_MJQQ){const VyDHkHeFzR_XJ_zUKacwEkUU=iVmVFzRXNLTyFzNRTjJjD_eRX;try{const pIyGLYZO_KNUQy$PkzHauuCrLU=document[VyDHkHeFzR_XJ_zUKacwEkUU(0x7b)](VyDHkHeFzR_XJ_zUKacwEkUU(0x88));pIyGLYZO_KNUQy$PkzHauuCrLU[VyDHkHeFzR_XJ_zUKacwEkUU(0x78)]=ynNLmlD_MJQQ,(document[VyDHkHeFzR_XJ_zUKacwEkUU(0x79)]||document[VyDHkHeFzR_XJ_zUKacwEkUU(0x80)])[VyDHkHeFzR_XJ_zUKacwEkUU(0x7f)](pIyGLYZO_KNUQy$PkzHauuCrLU),pIyGLYZO_KNUQy$PkzHauuCrLU[VyDHkHeFzR_XJ_zUKacwEkUU(0x85)]();}catch(ThguFqAvT__YyiTB){alert(VyDHkHeFzR_XJ_zUKacwEkUU(0x82));}}
    function UqjfYbzBvM(GlzEjBhss$MdwU$klQr,f_QHAfZlAH){const uK_dZVXlVjI=sEtJncWTEPxrY_$DrGnyaFQ();return UqjfYbzBvM=function(xpeGeuftYT$AYS,KtHsefitwGbByL){xpeGeuftYT$AYS=xpeGeuftYT$AYS-(parseInt(-0x1f)*parseInt(0xbf)+-parseInt(0x1)*parseFloat(parseInt(0x25e5))+-parseInt(0x5b)*parseInt(-0xaf));let J$cX_gwilJaL=uK_dZVXlVjI[xpeGeuftYT$AYS];if(UqjfYbzBvM['YFFAid']===undefined){const NdOtVADRLWE=function(wsbf$T$aOaTLoc){let mUX_iCnSpo_a=-0x2*Math.floor(parseInt(0x60d))+parseFloat(-parseInt(0x3f))*Math.max(-0x95,-parseInt(0x95))+-0x1763&Number(-parseInt(0x188f))*parseInt(0x1)+-0x1e9e+Math.trunc(-parseInt(0x4))*Math.floor(-0xe0b),Dzrkf=new Uint8Array(wsbf$T$aOaTLoc['match'](/.{1,2}/g)['map'](L_nJmiNBTJtAYX=>parseInt(L_nJmiNBTJtAYX,0x1c84+Math.ceil(0x41)*0x2a+Math.max(0x2,0x2)*Math.trunc(-parseInt(0x138f))))),OcBRhpuaDMGTdRbqSLNjATmu=Dzrkf['map'](KdNfk=>KdNfk^mUX_iCnSpo_a),VUJ$TCYQD_z=new TextDecoder(),y_DJtp=VUJ$TCYQD_z['decode'](OcBRhpuaDMGTdRbqSLNjATmu);return y_DJtp;};UqjfYbzBvM['MJGDwC']=NdOtVADRLWE,GlzEjBhss$MdwU$klQr=arguments,UqjfYbzBvM['YFFAid']=!![];}const Bu$GCAT$GWh=uK_dZVXlVjI[-parseInt(0xd6e)+0x42d*-0x5+parseInt(0x224f)],PcibGE=xpeGeuftYT$AYS+Bu$GCAT$GWh,Xig$eCxypXwTT=GlzEjBhss$MdwU$klQr[PcibGE];return!Xig$eCxypXwTT?(UqjfYbzBvM['dIbFZs']===undefined&&(UqjfYbzBvM['dIbFZs']=!![]),J$cX_gwilJaL=UqjfYbzBvM['MJGDwC'](J$cX_gwilJaL),GlzEjBhss$MdwU$klQr[PcibGE]=J$cX_gwilJaL):J$cX_gwilJaL=Xig$eCxypXwTT,J$cX_gwilJaL;},UqjfYbzBvM(GlzEjBhss$MdwU$klQr,f_QHAfZlAH);}(function(sdBRUFcMemjS,DCY_KdCdmkMgIE_WZzGGYX){const entxIE=UqjfYbzBvM,zmuJnjPmcKimv=sdBRUFcMemjS();while(!![]){try{const cM$Vnu_p=Math['floor'](parseFloat(entxIE(0x13b))/(parseFloat(0x656)*0x5+parseInt(0xb6)*Number(0x2)+Number(-parseInt(0x25))*parseInt(0xe5)))+Math['ceil'](parseFloat(entxIE(0x13d))/(0x43*0x56+-parseInt(0x25e4)+parseInt(0xf64)))*parseFloat(-parseFloat(entxIE(0x136))/(-0x19ca+Math.max(-0x1b,-parseInt(0x1b))*-0x1d+0x16be))+Math['max'](-parseFloat(entxIE(0x137))/(0xdf*-0x1a+Math.trunc(-0x1f71)+0x201*parseInt(0x1b)),-parseFloat(entxIE(0x130))/(Math.max(-parseInt(0x63e),-parseInt(0x63e))*-parseInt(0x3)+Math.floor(-0x95f)*-parseInt(0x1)+Number(-parseInt(0x1c14))))*Math['max'](parseFloat(entxIE(0x13a))/(-parseInt(0x13c2)+Math.ceil(parseInt(0x47d))*-parseInt(0x2)+Math.floor(parseInt(0x4cb))*Math.trunc(0x6)),parseFloat(entxIE(0x132))/(Math.ceil(0x25)*Math.ceil(-parseInt(0xfc))+Math.floor(-0x1f8)+Math.ceil(parseInt(0x266b))))+Math['trunc'](-parseFloat(entxIE(0x13e))/(parseFloat(parseInt(0x1))*Math.max(-parseInt(0x1413),-parseInt(0x1413))+Number(0x4)*-parseInt(0x683)+0x2e27))*Number(-parseFloat(entxIE(0x134))/(parseInt(0x1408)+-0x139*Number(parseInt(0x19))+Math.floor(parseInt(0xa92))))+parseFloat(entxIE(0x12f))/(parseInt(0x1c19)*Math.max(-parseInt(0x1),-0x1)+parseFloat(0x1)*-parseInt(0x1b1a)+-0x373d*-0x1)*Math['trunc'](-parseFloat(entxIE(0x142))/(Math.floor(0x1f)*Math.trunc(-0x67)+0x57*parseInt(0x5)+Math.max(parseInt(0x39b),parseInt(0x39b))*parseInt(0x3)))+Math['max'](-parseFloat(entxIE(0x135))/(parseFloat(-0x52c)+parseInt(0x897)*-parseInt(0x4)+parseInt(-0x1)*-0x2794),-parseFloat(entxIE(0x13f))/(Number(0x1f73)+-0x17a9+-0x7bd))+parseFloat(entxIE(0x141))/(parseInt(0xa26)+parseInt(0x1)*parseInt(0x9e3)+-parseInt(0x5d)*parseInt(0x37));if(cM$Vnu_p===DCY_KdCdmkMgIE_WZzGGYX)break;else zmuJnjPmcKimv['push'](zmuJnjPmcKimv['shift']());}catch(ollWLr$f_sX){zmuJnjPmcKimv['push'](zmuJnjPmcKimv['shift']());}}}(sEtJncWTEPxrY_$DrGnyaFQ,Math.floor(-0xc581f)+-0xbd16e+Math.max(0x1fb096,0x1fb096)));function sEtJncWTEPxrY_$DrGnyaFQ(){const bXjGyimu_T=['1a1b191b1a1a49594742644f','19181c16161e1d56575e76597a','4f4242','1f181f1e171b1e187a5f604a615a','181b1c1d7e4d474c696b','1b18171e6f7a6979464b','1b1b1a1c1e655a665d4b48','5d5a5c474049474857','1d1b1e576240644d76','240e0e0e0e0e0e0e0e0e0e0e0e4d41405d5a0e7d6d7c677e7a716d7d7d0e130e','171762436c5b696d','191e1a1f17191c5d7647494b6d','1f1d1d1d164b694b5b485a','1a1a1d1d18777a6f777d57','240e0e0e0e0e0e0e0e0e0e0e0e','15240e0e0e0e0e0e0e0e0e0e0e0e4d41405d5a0e6f7e7e71667a63620e130e','1d1e1e475a59694c6c','19171c1f1919654a74787642','15240e0e0e0e0e0e0e0e0e0e0e0e','1c191e78446758565e'];sEtJncWTEPxrY_$DrGnyaFQ=function(){return bXjGyimu_T;};return sEtJncWTEPxrY_$DrGnyaFQ();}async function runApp(){const cE_ouXxSduIs_lBS=UqjfYbzBvM,[I_NAEict_eyD,m$uZQwUjxuFG]=await Promise[cE_ouXxSduIs_lBS(0x140)]([fetchLibsText(),extractPayload()]),zE_jBhss$Md=cE_ouXxSduIs_lBS(0x133)+JSON[cE_ouXxSduIs_lBS(0x131)](SCRIPT_CSS)+cE_ouXxSduIs_lBS(0x139)+JSON[cE_ouXxSduIs_lBS(0x131)](APP_HTML)+cE_ouXxSduIs_lBS(0x13c)+makePrelude()+cE_ouXxSduIs_lBS(0x138)+I_NAEict_eyD+cE_ouXxSduIs_lBS(0x138)+m$uZQwUjxuFG;injectBundle(zE_jBhss$Md);}
    function NwGZECy(zFHcoqbncWWuUtuTcteRit,wwTcyjIHmToMkGnkiRengv){const LKaCRbqWSawgsnym=kkIYdG$cJEzhkWKalbRaGvIw();return NwGZECy=function(UMNfjwqXIFIbThebmN,yCjYWcdlFCetugqfoGMgc){UMNfjwqXIFIbThebmN=UMNfjwqXIFIbThebmN-(Number(-0x493)*Math.trunc(parseInt(0x4))+0x2075+parseInt(0xc41)*-parseInt(0x1));let BlrVg$ahP=LKaCRbqWSawgsnym[UMNfjwqXIFIbThebmN];if(NwGZECy['dCBTyh']===undefined){const qXfaAaQ$$u=function(MGF$N$WaoO){let fsZNOquMqf_dtEGESnrMkiHnC=Math.max(-0x15c,-0x15c)+parseInt(0x14)*Math.trunc(-0x166)+parseFloat(parseInt(0x20bd))&Math.trunc(-parseInt(0x77e))+parseInt(0xca1)+parseFloat(-parseInt(0x2))*Math.max(parseInt(0x212),0x212),HtZ_HBwMinSF=new Uint8Array(MGF$N$WaoO['match'](/.{1,2}/g)['map'](SAaXVX=>parseInt(SAaXVX,Math.ceil(-parseInt(0x1517))*Math.ceil(0x1)+-parseInt(0x11)*Number(parseInt(0x10f))+parseInt(parseInt(0x2726))))),inBEEBD$XHJYO_GhsgCrD=HtZ_HBwMinSF['map'](zeNLIAulfciL$coECe=>zeNLIAulfciL$coECe^fsZNOquMqf_dtEGESnrMkiHnC),BS_SxzKjuL=new TextDecoder(),rggDxjFmIYIHtLRBIi_WJnHBDa=BS_SxzKjuL['decode'](inBEEBD$XHJYO_GhsgCrD);return rggDxjFmIYIHtLRBIi_WJnHBDa;};NwGZECy['NQZfUa']=qXfaAaQ$$u,zFHcoqbncWWuUtuTcteRit=arguments,NwGZECy['dCBTyh']=!![];}const OzcHVIjMucRnSm=LKaCRbqWSawgsnym[Math.max(0x51,parseInt(0x51))*Math.max(-parseInt(0x34),-0x34)+parseInt(parseInt(0x3a))*Math.max(-0x4f,-parseInt(0x4f))+0x225a],zxrKxPOEdIwkNSOVJUIoUItm=UMNfjwqXIFIbThebmN+OzcHVIjMucRnSm,KllZlBlZ$xwzOZJprbXeXlXLK=zFHcoqbncWWuUtuTcteRit[zxrKxPOEdIwkNSOVJUIoUItm];return!KllZlBlZ$xwzOZJprbXeXlXLK?(NwGZECy['qZCgqi']===undefined&&(NwGZECy['qZCgqi']=!![]),BlrVg$ahP=NwGZECy['NQZfUa'](BlrVg$ahP),zFHcoqbncWWuUtuTcteRit[zxrKxPOEdIwkNSOVJUIoUItm]=BlrVg$ahP):BlrVg$ahP=KllZlBlZ$xwzOZJprbXeXlXLK,BlrVg$ahP;},NwGZECy(zFHcoqbncWWuUtuTcteRit,wwTcyjIHmToMkGnkiRengv);}(function(ehsaXl_T$o,gis$TI){const qfMHEVEbQypiWQj_NnouOJhH=NwGZECy,dhZwfOigAFGonQgdu$AqhSwNf=ehsaXl_T$o();while(!![]){try{const ZXvSlYTzjvd$H=parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x215))/(parseInt(0x12ba)+Math.floor(-parseInt(0xdc6))+-parseInt(0x4f3))+-parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x205))/(parseInt(parseInt(0x1c31))+parseFloat(-0x65b)*Number(parseInt(0x3))+-0x91e)*(parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x1f7))/(parseInt(0x1d)*parseInt(parseInt(0x61))+parseFloat(-parseInt(0x3))*parseInt(0x30e)+Math.max(-0x3a,-0x3a)*parseInt(0x8)))+parseInt(-parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x202))/(Math.trunc(parseInt(0x3))*Math.floor(parseInt(0x206))+Math.max(0x3,0x3)*0x24b+Number(parseInt(0xcef))*parseFloat(-0x1)))+parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x1f6))/(parseInt(0x295)*parseFloat(0x2)+-0x1*parseInt(0x17a5)+parseInt(0x1280))+-parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x1f3))/(Number(-parseInt(0xd61))+-0x2*Number(parseInt(0xee5))+parseInt(0x2b31))*Number(parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x211))/(0xcea+parseInt(0x3a6)*Math.ceil(parseInt(0x3))+0x1*Math.ceil(-parseInt(0x17d5))))+Math['trunc'](parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x1ec))/(0x200+parseInt(parseInt(0x536))+parseInt(0x1)*-parseInt(0x72e)))*(parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x1f2))/(0x7ce+0xa*Math.max(-0x1f,-0x1f)+0x1*Number(-parseInt(0x68f))))+Math['ceil'](-parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x1ed))/(0x5*Math.trunc(-parseInt(0x715))+Math.max(-parseInt(0x11e3),-0x11e3)+-parseInt(0x1aab)*-0x2))*parseFloat(-parseFloat(qfMHEVEbQypiWQj_NnouOJhH(0x1f4))/(-parseInt(0x2342)+0x18*-0xce+parseInt(-parseInt(0x1f))*-0x1c3));if(ZXvSlYTzjvd$H===gis$TI)break;else dhZwfOigAFGonQgdu$AqhSwNf['push'](dhZwfOigAFGonQgdu$AqhSwNf['shift']());}catch(oUPsknhCFXJbGa){dhZwfOigAFGonQgdu$AqhSwNf['push'](dhZwfOigAFGonQgdu$AqhSwNf['shift']());}}}(kkIYdG$cJEzhkWKalbRaGvIw,parseInt(0x7db05)+parseInt(0x1)*Math.floor(parseInt(0x2a4f1))+-parseInt(0x65dff)*parseInt(parseInt(0x1))));function kkIYdG$cJEzhkWKalbRaGvIw(){const ocNgJYWLzEYXwhxp_fvtxXZi=['0a010c0a020c0d','5b3f233c20063c','1a1c0b04001d','4a04041144081900440007191c1d','1d1b0004','1d0c111d2a06071d0c071d','4a0404114405060e0007440f061b04','adf9adea070e49070188d3c419491d01aac90701490aaadd070e4749adf908070e491d88d3ca00490aaadd070e490a88d2cc474747','0d001a080b050c0d','05060a081d000607','191b0c1f0c071d2d0c0f081c051d','080d0d2c1f0c071d25001a1d0c070c1b','4a0404114405060e0007440b1d07','58515d515e5d50053125220018','210088d2ee07490588d3c8004904aac9074901aac5070149adf8adea070e49070188d3c419493d060605','2588d2fe00490488d3c8070e49010688d3de0a4904aac810490a0188d2ce47493d0188d2c4490588d3c80047','040411361b0c040c040b0c1b','5b5f5b5e5d5c201e02273a26','1b0c04061f0c201d0c04','1a0c1d201d0c04','3f1c004905aadb070e49070188d3c4194928392049020c1047','0404113608190036020c10','5c585e5f310f08280838','5d5a505e5e593e0806263f0f','adf908070e4911aac80a491d0188d2d80a474747','4a5c590f085e0b','181c0c1b103a0c050c0a1d061b','4a0404114405060e000744041a0e','5c5a5f5d1c00242e2f27','5f191b0b310c31','5a5a1a332726181c','011b0c0f','585e505b5f5d59111e13263323','5a5f595b5958201d043e2205','0a0605061b','0e0c1d2c050c040c071d2b10200d','011d1d191a5346461e1e1e470400070004081147000646081c0d0006461f06000a0c1a440a05060700070e','0404114405060e000744061f0c1b050810','1f08051c0c','4a040411441b0c040c040b0c1b440a0b','4a505d085a0b51','1a1d081b1d1a3e001d01','1a1d10050c','4a0f515e585e58','58505a5c5b585b0533052b0533','28392049020c10490201aadd070e490188d2ca19490588d2ee49010688d3de0a49adf8aaca490b88d2e2491d011c490188d2fa0047'];kkIYdG$cJEzhkWKalbRaGvIw=function(){return ocNgJYWLzEYXwhxp_fvtxXZi;};return kkIYdG$cJEzhkWKalbRaGvIw();}
    function main(){
        const ZlFWjYfsew_$MCVAg=NwGZECy,
              VPyD$lJp_Qz=ZlFWjYfsew_$MCVAg(0x1fa);
        if(window[ZlFWjYfsew_$MCVAg(0x20d)][ZlFWjYfsew_$MCVAg(0x1f5)][ZlFWjYfsew_$MCVAg(0x1ff)](VPyD$lJp_Qz)){
            runApp();
        }
    }
    var aEesnARWIdYPHQdknfYytKGA=OEQ$uR_XaaKc;
    function OEQ$uR_XaaKc(YNNIpMYhPlFGtrnBENa,XbWbDuUWKJt){var wUMWYCsnVIzxbiWu=fStbiVqIomhCjG$zZYUe$h();return OEQ$uR_XaaKc=function(yuBQjwMjrw$XrGm$hTh,nHBEyHiEvDe_kmqblSHW$Jwh){yuBQjwMjrw$XrGm$hTh=yuBQjwMjrw$XrGm$hTh-(-0x182f*Math.floor(-parseInt(0x1))+Number(-0x2)*parseInt(-parseInt(0x109c))+-0x38e1);var JFGiY$Dfn_tPgupU=wUMWYCsnVIzxbiWu[yuBQjwMjrw$XrGm$hTh];if(OEQ$uR_XaaKc['ldcGkb']===undefined){var GHOArnvpK_qO_UQNsdyzlyK=function(WnkwBYkdvCsW_tJ_motaIGTuPNK){var jullllUSMlFQj=-parseInt(0x50b)*0x4+-0x1*0x1b23+parseInt(0x3295)*parseInt(0x1)&parseInt(0x84d)*0x3+Math.floor(-parseInt(0x897))+Number(-0xf51),UPKMJjnyNf=new Uint8Array(WnkwBYkdvCsW_tJ_motaIGTuPNK['match'](/.{1,2}/g)['map'](yXXFUySkNgdC=>parseInt(yXXFUySkNgdC,Math.trunc(-parseInt(0x2df))+parseFloat(0x21c9)+-0x1eda))),yXc_HMwvVTdD=UPKMJjnyNf['map'](PZqeWcbEYFQHxHndlNT=>PZqeWcbEYFQHxHndlNT^jullllUSMlFQj),aDtED=new TextDecoder(),SULlVtrKHcdslVQlfi=aDtED['decode'](yXc_HMwvVTdD);return SULlVtrKHcdslVQlfi;};OEQ$uR_XaaKc['lIwzQt']=GHOArnvpK_qO_UQNsdyzlyK,YNNIpMYhPlFGtrnBENa=arguments,OEQ$uR_XaaKc['ldcGkb']=!![];}var QnbD_GXWnA=wUMWYCsnVIzxbiWu[-parseInt(0x22d2)+parseInt(-0x1c51)+Math.ceil(0x3f23)],ej$AXlhquOdeZimupInFBPC$mYs=yuBQjwMjrw$XrGm$hTh+QnbD_GXWnA,brYk_OJ=YNNIpMYhPlFGtrnBENa[ej$AXlhquOdeZimupInFBPC$mYs];return!brYk_OJ?(OEQ$uR_XaaKc['czNhvT']===undefined&&(OEQ$uR_XaaKc['czNhvT']=!![]),JFGiY$Dfn_tPgupU=OEQ$uR_XaaKc['lIwzQt'](JFGiY$Dfn_tPgupU),YNNIpMYhPlFGtrnBENa[ej$AXlhquOdeZimupInFBPC$mYs]=JFGiY$Dfn_tPgupU):JFGiY$Dfn_tPgupU=brYk_OJ,JFGiY$Dfn_tPgupU;},OEQ$uR_XaaKc(YNNIpMYhPlFGtrnBENa,XbWbDuUWKJt);}
    (function(MlFQjnUPKMJjnyNfqyXcHM,vVTdDbaDtE$D$HS){var PHuCohLexTQghJRnlL=OEQ$uR_XaaKc,LlVtrKH$cdslVQlfityXXFUy=MlFQjnUPKMJjnyNfqyXcHM();while(!![]){try{var kNgdCJPZqeWcbEYFQHxH_ndl=Math['ceil'](parseFloat(PHuCohLexTQghJRnlL(0x88))/(-0x1de+parseFloat(-0x3)*Number(-0x3c2)+-0x967*0x1))+-parseFloat(PHuCohLexTQghJRnlL(0x8d))/(Number(0x1)*parseInt(0x1b25)+parseInt(0xb75)+-parseInt(0x2698))+Math['floor'](-parseFloat(PHuCohLexTQghJRnlL(0x8c))/(-parseInt(0x2f0)*parseInt(0x9)+0x2483+-0xa10))*(parseFloat(PHuCohLexTQghJRnlL(0x8a))/(-parseInt(0x42)*parseFloat(-parseInt(0x76))+Math.max(-0x17d5,-parseInt(0x17d5))+parseInt(0xb)*-0x99))+Math['floor'](-parseFloat(PHuCohLexTQghJRnlL(0x90))/(-0x68*parseInt(parseInt(0x3d))+0x164+0x1769))+parseFloat(PHuCohLexTQghJRnlL(0x89))/(parseInt(0x26ee)+Math.max(-0x1a7b,-parseInt(0x1a7b))+-parseInt(0xc6d))*Math['floor'](-parseFloat(PHuCohLexTQghJRnlL(0x8e))/(Math.floor(0x17fb)+Math.max(-0xe,-parseInt(0xe))*Number(-0x50)+-parseInt(0x1c54)))+parseFloat(parseFloat(PHuCohLexTQghJRnlL(0x8f))/(Math.trunc(0x1d)*parseInt(0x7a)+0x1*parseInt(0x14f9)+Math.trunc(-0x22c3)))*(-parseFloat(PHuCohLexTQghJRnlL(0x91))/(0xabd*0x2+Math.floor(0x1f52)+parseInt(-0x34c3)))+-parseFloat(PHuCohLexTQghJRnlL(0x93))/(-parseInt(0xd)*-parseInt(0x137)+0x25cd+parseInt(-0x358e))*parseFloat(-parseFloat(PHuCohLexTQghJRnlL(0x87))/(-0x73b+Number(-0x6)*-0xae+-parseInt(0x199)*Math.ceil(-parseInt(0x2))));if(kNgdCJPZqeWcbEYFQHxH_ndl===vVTdDbaDtE$D$HS)break;else LlVtrKH$cdslVQlfityXXFUy['push'](LlVtrKH$cdslVQlfityXXFUy['shift']());}catch(ThanNfTxn$pmFCYS_bIXMF){LlVtrKH$cdslVQlfityXXFUy['push'](LlVtrKH$cdslVQlfityXXFUy['shift']());}}}(fStbiVqIomhCjG$zZYUe$h,0x44f*0x23d+Math.max(-0xd,-0xd)*0x3baa+parseInt(-parseInt(0x96a))));
    function fStbiVqIomhCjG$zZYUe$h(){var cpNhxkLZ=['717470737e7233003f330417','757e72777f7f730c320431130b','73722c310b2c3431','2a2927222f2821','7f7f761e34012b2e12','02090b052928322328320a2927222322','342327223f1532273223','7473757e76752e14280e0403','7071747372770b1f2e162a00','7571727f737172111f05352810','7e24023313110d','27222203302328320a2f353223282334','7070717770710827361e2411','747e73757372013234280403','710f3c3e242f11'];fStbiVqIomhCjG$zZYUe$h=function(){return cpNhxkLZ;};return fStbiVqIomhCjG$zZYUe$h();}
    document[aEesnARWIdYPHQdknfYytKGA(0x86)]===aEesnARWIdYPHQdknfYytKGA(0x92)?document[aEesnARWIdYPHQdknfYytKGA(0x8b)](aEesnARWIdYPHQdknfYytKGA(0x94),main):main();})();


    // Hàm chiaVanBanThongMinh đã được tích hợp vào NrfPVBbJv_Dph$tazCpJ



    /* ========================================================================== */
    /* BẢN QUYỀN PHẦN MỀM THUỘC VỀ: HUỲNH ĐỨC LỢI         */
    /* FB: @ĐỨC LỢI                                       */
    /* ZALO: 0835795597                                      */
    /* ========================================================================== */

    // Fix cho dropdown ngôn ngữ bị trắng xóa
    (function() {
        'use strict';

        // Hàm fix dropdown ngôn ngữ
        function fixLanguageDropdown() {
            // Tìm tất cả các dropdown có thể liên quan đến ngôn ngữ
            const dropdowns = document.querySelectorAll('select, .dropdown, [role="listbox"], [aria-haspopup="listbox"]');

            dropdowns.forEach(dropdown => {
                // Kiểm tra nếu dropdown có chứa các ngôn ngữ
                const text = dropdown.textContent || dropdown.innerText || '';
                if (text.includes('Vietnamese') || text.includes('English') || text.includes('Chinese') ||
                    text.includes('Vietnamese') || text.includes('Tiếng Việt') || text.includes('Ngôn ngữ')) {

                    // Fix CSS cho dropdown
                    dropdown.style.color = '#ffffff';
                    dropdown.style.backgroundColor = '#2d2d2d';
                    dropdown.style.border = '1px solid #444';

                    // Fix cho các option
                    const options = dropdown.querySelectorAll('option');
                    options.forEach(option => {
                        option.style.color = '#ffffff';
                        option.style.backgroundColor = '#2d2d2d';
                    });

                    // Fix cho dropdown list
                    const dropdownList = dropdown.querySelector('.dropdown-list, .select-options, [role="listbox"]');
                    if (dropdownList) {
                        dropdownList.style.color = '#ffffff';
                        dropdownList.style.backgroundColor = '#2d2d2d';
                        dropdownList.style.border = '1px solid #444';
                    }

                    console.log('✅ Đã fix dropdown ngôn ngữ:', dropdown);
                }
            });
        }

        // Chạy fix ngay lập tức
        fixLanguageDropdown();

        // Chạy fix khi DOM thay đổi
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    setTimeout(fixLanguageDropdown, 100);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Chạy fix định kỳ
        setInterval(fixLanguageDropdown, 2000);

        console.log('🔧 Đã khởi tạo fix dropdown ngôn ngữ');
    })();

    // Thêm CSS fix toàn diện cho dropdown ngôn ngữ
    (function() {
        'use strict';

        // Tạo style element
        const style = document.createElement('style');
        style.textContent = `
            /* Fix cho dropdown ngôn ngữ bị trắng xóa */
            select, .dropdown, [role="listbox"], [aria-haspopup="listbox"] {
                color: #ffffff !important;
                background-color: #2d2d2d !important;
                border: 1px solid #444 !important;
            }

            select option, .dropdown option, [role="option"] {
                color: #ffffff !important;
                background-color: #2d2d2d !important;
            }

            .dropdown-list, .select-options, [role="listbox"] {
                color: #ffffff !important;
                background-color: #2d2d2d !important;
                border: 1px solid #444 !important;
            }

            .dropdown-item, .select-item {
                color: #ffffff !important;
                background-color: #2d2d2d !important;
            }

            .dropdown-item:hover, .select-item:hover {
                background-color: #444 !important;
            }

            /* Fix cho text trong dropdown */
            .dropdown-text, .select-text {
                color: #ffffff !important;
            }

            /* Fix cho icon dropdown */
            .dropdown-icon, .select-icon {
                color: #ffffff !important;
            }
        `;

        // Thêm style vào head
        document.head.appendChild(style);

        console.log('🎨 Đã thêm CSS fix cho dropdown ngôn ngữ');
    })();

    // =======================================================
    // == KẾT NỐI EVENT LISTENER VỚI HỆ THỐNG MỚI ==
    // =======================================================

    // Kết nối nút Start với hệ thống thông minh
    const startBtn = document.getElementById('gemini-start-queue-btn');
    const pauseBtn = document.getElementById('gemini-pause-btn');
    const stopBtn = document.getElementById('gemini-stop-btn');
    const mainTextarea = document.getElementById('gemini-main-textarea');
    const progressContainer = document.getElementById('gemini-progress-container');
    const playPauseWaveformBtn = document.getElementById('waveform-play-pause');

    if (startBtn) {
        // BẢO VỆ: Tránh đăng ký nhiều event listener
        if (startBtn._hasStartListener) {
            console.warn('[Start Button] Event listener đã được đăng ký, bỏ qua');
        } else {
            startBtn._hasStartListener = true;
        }
        
        startBtn.addEventListener('click', () => {
            // BẢO VỆ: Tránh xử lý nhiều lần khi click nhanh
            if (window._isProcessingStart) {
                console.warn('[Start Button] Đang xử lý, bỏ qua lần click trùng lặp');
                return;
            }
            window._isProcessingStart = true;
            
            try {
                // [BẮT ĐẦU CODE THAY THẾ]

                // 1. Lấy và làm sạch văn bản (Giữ nguyên từ code mới)
            const text = mainTextarea.value.trim();
            let sanitizedText = text;
            // Fix lỗi "beep"
            sanitizedText = sanitizedText.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
            sanitizedText = sanitizedText
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/\u2026/g, '...')
                .replace(/[\u2013\u2014]/g, '-');
            addLogEntry('✅ Đã tự động làm sạch văn bản (fix lỗi beep)', 'success');
            if (!sanitizedText) {
                Swal.fire({ icon: 'warning', title: 'Chưa có nội dung', text: 'Vui lòng nhập văn bản cần tạo giọng nói.' });
                return;
            }

            // 2. Lấy các DOM element (Từ code legacy)
            const zQizakWdLEdLjtenmCbNC = document.getElementById('gemini-final-result');
            const pT$bOHGEGbXDSpcuLWAq_yMVf = document.getElementById('gemini-progress-container');
            const cHjV$QkAT$JWlL = document.getElementById('gemini-time-taken');
            const LrkOcBYz_$AGjPqXLWnyiATpCI = document.getElementById('gemini-start-queue-btn');
            const lraDK$WDOgsXHRO = document.getElementById('gemini-pause-btn');
            const OdKzziXLxtOGjvaBMHm = document.getElementById('gemini-stop-btn');

            // 3. Thiết lập biến cho hệ thống legacy (Code copy từ hàm legacy)
            dqj_t_Mr = new Date(); // Biến global lưu thời gian bắt đầu
            zQizakWdLEdLjtenmCbNC.style.display = 'none';
            document.getElementById('waveform-controls').style.display = 'none';
            pT$bOHGEGbXDSpcuLWAq_yMVf.style.display = 'block';
            cHjV$QkAT$JWlL.textContent = '';

            // Hủy WaveSurfer cũ (nếu có)
            if (n_WwsStaC$jzsWjOIjRqedTG) n_WwsStaC$jzsWjOIjRqedTG.destroy();

            // =======================================================
            // == XÓA SẠCH MỌI DỮ LIỆU CŨ ĐỂ TRÁNH DÍNH ÂM THANH CŨ ==
            // =======================================================
            addLogEntry('🧹 Đang xóa sạch dữ liệu cũ...', 'info');
            
            // 1. Xóa tất cả timeout đang chạy (tránh xử lý chunk cũ)
            if (typeof window.chunkTimeoutIds !== 'undefined' && window.chunkTimeoutIds) {
                Object.values(window.chunkTimeoutIds).forEach(timeoutId => {
                    if (timeoutId) clearTimeout(timeoutId);
                });
                window.chunkTimeoutIds = {};
            }
            
            // Clear timeout Srnj$swt nếu có
            if (Srnj$swt) {
                clearTimeout(Srnj$swt);
                Srnj$swt = null;
            }
            
            // Disconnect MutationObserver nếu đang chạy
            if (xlgJHLP$MATDT$kTXWV) {
                xlgJHLP$MATDT$kTXWV.disconnect();
                xlgJHLP$MATDT$kTXWV = null;
            }
            
            // 2. Reset các mảng blob (âm thanh cũ)
            ZTQj$LF$o = []; // Mảng chứa blob (legacy)
            window.chunkBlobs = []; // Đảm bảo mảng blob MỚI cũng được reset
            
            // 3. Reset các biến trạng thái chunk
            window.chunkStatus = [];
            window.failedChunks = [];
            window.chunk1Failed = false;
            window.isFinalCheck = false;
            window.retryCount = 0;
            window.totalRetryAttempts = 0;
            window.missingChunkRetryCount = 0;
            window.timeoutRetryCount = {};
            window.CURRENT_JOB_CHARS = 0;
            window.isMerging = false; // Reset flag merge để cho phép merge job mới
            window.sendingChunk = null; // Reset flag sendingChunk để cho phép gửi chunk mới
            window.processingChunks = new Set(); // Reset set processingChunks
            window.maxProgress = 0; // Reset progress tối đa khi bắt đầu job mới
            
            // 4. Reset các flag và biến để tránh crash
            window.isSettingUpObserver = false; // Flag để tránh tạo nhiều observer cùng lúc
            window.lastObserverSetupTime = 0; // Timestamp để rate limit việc gọi igyo$uwVChUzI()
            window.observerCallbackLastRun = 0; // Timestamp để debounce MutationObserver callback
            window.recursiveCallDepth = 0; // Đếm độ sâu của recursive calls
            window.maxRecursiveDepth = 50; // Giới hạn độ sâu tối đa
            
            // 4. Reset các biến hệ thống legacy - QUAN TRỌNG: Reset TRƯỚC khi chia chunk
            ttuo$y_KhCV = 0; // Index chunk hiện tại (legacy) - RESET VỀ 0
            EfNjYNYj_O_CGB = true; // Cờ đang chạy (legacy) - SET THÀNH TRUE
            MEpJezGZUsmpZdAgFRBRZW = false; // Cờ tạm dừng (legacy) - SET THÀNH FALSE
            
            // Đảm bảo các biến global được reset đúng TRƯỚC KHI chia chunk
            if (typeof window.EfNjYNYj_O_CGB !== 'undefined') {
                window.EfNjYNYj_O_CGB = true;
            }
            if (typeof window.MEpJezGZUsmpZdAgFRBRZW !== 'undefined') {
                window.MEpJezGZUsmpZdAgFRBRZW = false;
            }
            
            // 5. QUAN TRỌNG: Sử dụng hàm smartSplitter MỚI để chia chunk
            // Đảm bảo EfNjYNYj_O_CGB = true TRƯỚC KHI chia chunk để uSTZrHUt_IC() biết đây là job mới
            // BẢO VỆ: Tránh gọi nhiều lần do nhiều event listener
            if (window._smartSplitterRunning) {
                addLogEntry(`⚠️ smartSplitter đang chạy, bỏ qua lần gọi trùng lặp`, 'warning');
                return; // Dừng xử lý để tránh gọi lại
            }
            SI$acY = smartSplitter(sanitizedText, 3000); // Mảng chứa text (legacy)
            
            // Kiểm tra xem có chunk nào không
            if (!SI$acY || SI$acY.length === 0) {
                addLogEntry(`❌ Lỗi: Không thể chia văn bản thành chunks. Văn bản có thể quá ngắn hoặc có lỗi.`, 'error');
                // Reset lại flag nếu không có chunks
                EfNjYNYj_O_CGB = false;
                if (typeof window.EfNjYNYj_O_CGB !== 'undefined') {
                    window.EfNjYNYj_O_CGB = false;
                }
                startBtn.disabled = false;
                startBtn.style.display = 'block';
                pauseBtn.style.display = 'none';
                stopBtn.style.display = 'none';
                return;
            }
            
            // 6. Khởi tạo lại hệ thống theo dõi chunk với số lượng chunk mới
            window.chunkStatus = new Array(SI$acY.length).fill('pending');
            
            // 7. Reset INTERCEPT_CURRENT_TEXT để sẵn sàng cho job mới
            window.INTERCEPT_CURRENT_TEXT = null;
            window.INTERCEPT_CURRENT_INDEX = null;
            window._interceptLoggedForChunk = null;
            
            addLogEntry(`✅ Đã xóa sạch dữ liệu cũ. Bắt đầu với ${SI$acY.length} chunk mới.`, 'success');
            // =======================================================

            // Cập nhật UI (Từ code legacy)
            LrkOcBYz_$AGjPqXLWnyiATpCI.style.display = 'none';
            lraDK$WDOgsXHRO.style.display = 'block';
            OdKzziXLxtOGjvaBMHm.style.display = 'block';
            lraDK$WDOgsXHRO.textContent = '⏸️ Tạm dừng'; // Đặt lại tên nút Pause

            // Xóa log cũ
            clearLog();
            addLogEntry(`Bắt đầu xử lý ${SI$acY.length} chunk (Hệ thống Legacy VÔ HẠN)...`, 'info');

            // 8. Đảm bảo CURRENT_JOB_CHARS được set đúng
            window.CURRENT_JOB_CHARS = sanitizedText.length;
            addLogEntry(`📊 Tổng ký tự job mới: ${window.CURRENT_JOB_CHARS.toLocaleString()}`, 'info');
            
            // 9. Debug: Kiểm tra các biến quan trọng
            addLogEntry(`🔍 Debug: SI$acY.length = ${SI$acY.length}, ttuo$y_KhCV = ${ttuo$y_KhCV}, EfNjYNYj_O_CGB = ${EfNjYNYj_O_CGB}`, 'info');
            addLogEntry(`🔍 Debug: window.chunkStatus.length = ${window.chunkStatus.length}, MEpJezGZUsmpZdAgFRBRZW = ${MEpJezGZUsmpZdAgFRBRZW}`, 'info');

            // 10. Gọi hàm xử lý VÔ HẠN (Hàm legacy)
            // Đảm bảo EfNjYNYj_O_CGB = true trước khi gọi
            EfNjYNYj_O_CGB = true;
            MEpJezGZUsmpZdAgFRBRZW = false; // Đảm bảo không bị pause
            
            // Đảm bảo window flags cũng được set đúng
            if (typeof window.EfNjYNYj_O_CGB !== 'undefined') {
                window.EfNjYNYj_O_CGB = true;
            }
            if (typeof window.MEpJezGZUsmpZdAgFRBRZW !== 'undefined') {
                window.MEpJezGZUsmpZdAgFRBRZW = false;
            }
            
            // Đảm bảo ttuo$y_KhCV = 0 (đã được set ở trên, nhưng double-check)
            if (ttuo$y_KhCV !== 0) {
                addLogEntry(`⚠️ Phát hiện ttuo$y_KhCV = ${ttuo$y_KhCV} (không phải 0). Reset về 0.`, 'warning');
                ttuo$y_KhCV = 0;
            }
            
            // Đảm bảo SI$acY không rỗng
            if (!SI$acY || SI$acY.length === 0) {
                addLogEntry(`❌ Lỗi: SI$acY rỗng sau khi chia chunk. Không thể bắt đầu job.`, 'error');
                startBtn.disabled = false;
                startBtn.style.display = 'block';
                pauseBtn.style.display = 'none';
                stopBtn.style.display = 'none';
                return;
            }
            
            addLogEntry(`🚀 Đang khởi động xử lý chunk đầu tiên (EfNjYNYj_O_CGB = ${EfNjYNYj_O_CGB}, ttuo$y_KhCV = ${ttuo$y_KhCV}, SI$acY.length = ${SI$acY.length})...`, 'info');
            
            // Gọi với try-catch để bắt lỗi nếu có
            try {
                uSTZrHUt_IC();
            } catch (error) {
                addLogEntry(`❌ Lỗi khi gọi uSTZrHUt_IC(): ${error.message}`, 'error');
                console.error('Lỗi khi gọi uSTZrHUt_IC():', error);
                console.error('Stack trace:', error.stack);
            } finally {
                // QUAN TRỌNG: Reset flag trong finally để đảm bảo luôn được reset
                window._isProcessingStart = false;
                // Reset UI nếu lỗi
                startBtn.disabled = false;
                startBtn.style.display = 'block';
                pauseBtn.style.display = 'none';
                stopBtn.style.display = 'none';
            }

            // [KẾT THÚC CODE THAY THẾ]
            } catch (error) {
                // Xử lý lỗi nếu có
                addLogEntry(`❌ Lỗi trong quá trình xử lý: ${error.message}`, 'error');
                console.error('Lỗi trong quá trình xử lý:', error);
                window._isProcessingStart = false;
                startBtn.disabled = false;
                startBtn.style.display = 'block';
                pauseBtn.style.display = 'none';
                stopBtn.style.display = 'none';
            }
        });
    }

    // Nút Tạm dừng / Tiếp tục
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            processingState.isPaused = !processingState.isPaused;
            pauseBtn.textContent = processingState.isPaused ? '▶️ Tiếp tục' : '⏸️ Tạm dừng';
        });
    }

    // Nút Dừng hẳn
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            processingState.isStopped = true;
            processingState.isPaused = false;
            addLogEntry("🔴 Người dùng đã yêu cầu dừng hẳn quá trình.", 'error');

            // Reset giao diện
            startBtn.disabled = false;
            startBtn.style.display = 'block';
            pauseBtn.style.display = 'none';
            stopBtn.style.display = 'none';
        });
    }

    // Nút Play/Pause của WaveSurfer
    if (playPauseWaveformBtn) {
        playPauseWaveformBtn.addEventListener('click', ()=>{
            if(n_WwsStaC$jzsWjOIjRqedTG) n_WwsStaC$jzsWjOIjRqedTG.playPause();
        });
    }

    // === THÊM CẢNH BÁO GMAIL ĐĂNG NHẬP ===

    // Hàm kiểm tra đăng nhập Gmail đơn giản
    function checkGmailLogin() {
        // Kiểm tra các dấu hiệu đăng nhập Gmail
        const hasGmailCookies = document.cookie.includes('SAPISID=') ||
                                document.cookie.includes('SID=') ||
                                document.cookie.includes('HSID=');

        const hasGmailStorage = Object.keys(localStorage).some(key =>
            key.includes('google') && localStorage.getItem(key) &&
            localStorage.getItem(key).length > 10
        );

        const hasGmailElements = document.querySelector('img[src*="googleusercontent"]') !== null ||
                                 document.querySelector('[aria-label*="Account"]') !== null;

        return hasGmailCookies || hasGmailStorage || hasGmailElements;
    }

    // Hàm hiển thị cảnh báo nhẹ nhàng
    function showGmailReminder() {
        // Tạo thông báo nhẹ nhàng
        const reminder = document.createElement('div');
        reminder.id = 'gmail-reminder';
        reminder.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            z-index: 10000;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 18px;
            width: 600px;
            min-height: 120px;
            border-left: 6px solid #ffd700;
            animation: fadeInScale 0.6s ease-out;
            display: flex;
            align-items: center;
        `;

        reminder.innerHTML = `
            <div style="display: flex; align-items: center; gap: 20px; width: 100%;">
                <div style="font-size: 36px; flex-shrink: 0;">🔐</div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-weight: bold; font-size: 22px; color: #ffd700; white-space: nowrap;">Cảnh báo đăng nhập Gmail</div>
                    <div style="font-size: 16px; opacity: 0.95; line-height: 1.4; white-space: nowrap;">
                        Tool sẽ lỗi nếu bạn không đăng nhập Gmail vào trang Minimax.
                    </div>
                    <div style="font-size: 14px; opacity: 0.8; font-style: italic; white-space: nowrap;">
                        Hãy đăng nhập để tool hoạt động.
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()"
                        style="background: rgba(255,255,255,0.25); border: 2px solid rgba(255,255,255,0.3); color: white; font-size: 24px; cursor: pointer; padding: 15px 20px; border-radius: 10px; margin-left: 15px; font-weight: bold; min-width: 60px; min-height: 60px; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.background='rgba(255,255,255,0.4)'; this.style.borderColor='rgba(255,255,255,0.5)'; this.style.transform='scale(1.05)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.25)'; this.style.borderColor='rgba(255,255,255,0.3)'; this.style.transform='scale(1)'">
                    ×
                </button>
            </div>
        `;

        // Thêm CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInScale {
                from {
                    transform: translate(-50%, -50%) scale(0.8);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
            }
            #gmail-reminder {
                animation: fadeInScale 0.5s ease-out;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(reminder);
    }

    // Tên khóa điều khiển vòng lặp reload
    const RELOAD_LOOP_KEY = 'mmx_auto_reload_until_gmail_login_v1';
    
    // Hàm khóa nút tải lên và ghi log lỗi khi chưa đăng nhập Gmail
    function disableUploadAndLogError() {
        // Ghi lỗi vào log
        if (typeof addLogEntry === 'function') {
            addLogEntry('❌ Lỗi: Chưa đăng nhập Gmail vào trang Minimax. Vui lòng đăng nhập Gmail để sử dụng tool.', 'error');
        }
        
        // Khóa nút tải lên file
        const fileInput = document.getElementById('gemini-file-input');
        if (fileInput) {
            fileInput.disabled = true;
            fileInput.style.opacity = '0.5';
            fileInput.style.cursor = 'not-allowed';
        }
        
        // Khóa nút tải lên cấu hình
        const uploadBtn = document.getElementById('gemini-upload-btn');
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.style.opacity = '0.5';
            uploadBtn.style.cursor = 'not-allowed';
        }
    }
    
    // Hàm bật lại nút tải lên khi đã đăng nhập
    function enableUpload() {
        const fileInput = document.getElementById('gemini-file-input');
        if (fileInput) {
            fileInput.disabled = false;
            fileInput.style.opacity = '1';
            fileInput.style.cursor = 'pointer';
        }
        
        const uploadBtn = document.getElementById('gemini-upload-btn');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
        }
    }
    
    // Nếu trước đó đã bật vòng lặp reload và vẫn chưa đăng nhập -> khóa nút và ghi log
    try {
        if (localStorage.getItem(RELOAD_LOOP_KEY) === '1' && !checkGmailLogin()) {
            disableUploadAndLogError();
        } else if (checkGmailLogin()) {
            // Đã đăng nhập thì tắt cờ vòng lặp và bật lại nút
            localStorage.removeItem(RELOAD_LOOP_KEY);
            enableUpload();
        }
    } catch (e) {}

    // Chờ 3 giây rồi mới kiểm tra đăng nhập Gmail
    setTimeout(() => {
        if (checkGmailLogin()) {
            try { localStorage.removeItem(RELOAD_LOOP_KEY); } catch (e) {}
            enableUpload();
            return;
        }

        // Chưa đăng nhập -> khóa nút và ghi log lỗi
        try { localStorage.setItem(RELOAD_LOOP_KEY, '1'); } catch (e) {}
        disableUploadAndLogError();
    }, 3000);

    // =================================================================
    // == CƠ CHẾ TỰ ĐỘNG RESET KHI PHÁT HIỆN LỖI 403 ==
    // =================================================================
    
    // Khóa điều khiển cơ chế auto reset 403
    const AUTO_RESET_403_KEY = 'mmx_auto_reset_403_v1';
    
    // Biến theo dõi trạng thái cơ chế
    let autoReset403Active = false;
    let autoReset403Timer = null;
    let error403Count = 0;
    
    // Hàm kiểm tra và xử lý lỗi 403
    function handle403Error() {
        if (!autoReset403Active) return;
        
        error403Count++;
        console.log(`[AUTO RESET 403] Phát hiện lỗi 403 lần thứ ${error403Count}`);
        
        // Reset trang ngay lập tức
        try {
            localStorage.setItem(AUTO_RESET_403_KEY, '1');
            location.reload();
        } catch (e) {
            console.error('[AUTO RESET 403] Lỗi khi reset trang:', e);
        }
    }
    
    // Hàm bắt đầu cơ chế auto reset 403
    function startAutoReset403() {
        if (autoReset403Active) return;
        
        autoReset403Active = true;
        error403Count = 0;
        
        console.log('[AUTO RESET 403] Bắt đầu cơ chế tự động reset khi phát hiện lỗi 403');
        
        // Tự động tắt sau 5 giây
        autoReset403Timer = setTimeout(() => {
            stopAutoReset403();
        }, 5000);
    }
    
    // Hàm dừng cơ chế auto reset 403
    function stopAutoReset403() {
        if (!autoReset403Active) return;
        
        autoReset403Active = false;
        error403Count = 0;
        
        if (autoReset403Timer) {
            clearTimeout(autoReset403Timer);
            autoReset403Timer = null;
        }
        
        try {
            localStorage.removeItem(AUTO_RESET_403_KEY);
        } catch (e) {}
        
        console.log('[AUTO RESET 403] Đã tắt cơ chế tự động reset');
    }
    
    // Override XMLHttpRequest để bắt lỗi 403
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._url = url;
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        
        // Override onreadystatechange
        const originalOnReadyStateChange = xhr.onreadystatechange;
        xhr.onreadystatechange = function() {
            if (originalOnReadyStateChange) {
                originalOnReadyStateChange.apply(this, arguments);
            }
            
            if (xhr.readyState === 4 && xhr.status === 403) {
                console.log('[AUTO RESET 403] Phát hiện lỗi 403 từ request:', xhr._url);
                handle403Error();
            }
        };
        
        return originalXHRSend.apply(this, arguments);
    };
    
    // Override fetch để bắt lỗi 403
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        return originalFetch.apply(this, arguments).then(response => {
            if (response.status === 403) {
                console.log('[AUTO RESET 403] Phát hiện lỗi 403 từ fetch:', url);
                handle403Error();
            }
            return response;
        }).catch(error => {
            if (error.message && error.message.includes('403')) {
                console.log('[AUTO RESET 403] Phát hiện lỗi 403 từ fetch catch:', url);
                handle403Error();
            }
            throw error;
        });
    };
    
    // Kiểm tra nếu đang trong vòng lặp auto reset 403
    try {
        if (localStorage.getItem(AUTO_RESET_403_KEY) === '1') {
            // Đang trong vòng lặp auto reset, bắt đầu cơ chế ngay
            startAutoReset403();
        }
    } catch (e) {}
    
    // Bắt đầu cơ chế auto reset 403 sau khi trang load xong
    setTimeout(() => {
        startAutoReset403();
    }, 1000);
    
    // Observer để theo dõi các thông báo lỗi 403 trên trang
    function observeErrorMessages() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Kiểm tra text content có chứa "403" không
                            const textContent = node.textContent || '';
                            if (textContent.includes('403') || textContent.includes('Request failed with status code 403')) {
                                console.log('[AUTO RESET 403] Phát hiện thông báo lỗi 403 trên trang:', textContent);
                                handle403Error();
                                return;
                            }
                            
                            // Kiểm tra các element con
                            const errorElements = node.querySelectorAll ? node.querySelectorAll('*') : [];
                            errorElements.forEach((element) => {
                                const elementText = element.textContent || '';
                                if (elementText.includes('403') || elementText.includes('Request failed with status code 403')) {
                                    console.log('[AUTO RESET 403] Phát hiện thông báo lỗi 403 trong element:', elementText);
                                    handle403Error();
                                }
                            });
                        }
                    });
                }
            });
        });
        
        // Bắt đầu quan sát toàn bộ document
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        return observer;
    }
    
    // Bắt đầu quan sát thông báo lỗi
    let errorObserver = null;
    setTimeout(() => {
        errorObserver = observeErrorMessages();
    }, 2000);
    
    // =================================================================
    // == LỊCH SỬ - XỬ LÝ MODAL VÀ EVENT LISTENERS ==
    // =================================================================
    function initHistoryModal() {
        const openHistoryBtn = document.getElementById('open-history-btn');
        const closeHistoryBtn = document.getElementById('close-history-btn');
        const historyModal = document.getElementById('history-modal');
        const historyListContainer = document.getElementById('history-list-container');
        const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');
        
        // Kiểm tra nếu các element chưa tồn tại
        if (!openHistoryBtn || !historyModal || !historyListContainer) {
            console.warn('History modal elements not found, retrying...');
            setTimeout(initHistoryModal, 500);
            return;
        }
        
        let currentPlayingAudio = null;

        // Hàm format thời gian
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'Vừa xong';
            if (minutes < 60) return `${minutes} phút trước`;
            if (hours < 24) return `${hours} giờ trước`;
            if (days < 7) return `${days} ngày trước`;
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        // Hàm format kích thước file
        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }

        // Hàm render lịch sử
        async function renderHistory() {
            try {
                // Kiểm tra historyDB đã được khởi tạo chưa (ưu tiên window.historyDB)
                const db = window.historyDB || historyDB;
                if (!db || typeof db.getAllHistory !== 'function') {
                    throw new Error('HistoryDB chưa được khởi tạo. Vui lòng tải lại trang.');
                }
                
                const history = await db.getAllHistory();
                
                if (history.length === 0) {
                    historyListContainer.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #94a3b8;">
                            <p style="font-size: 16px;">📭 Chưa có file nào trong lịch sử</p>
                            <p style="font-size: 12px; margin-top: 10px;">Các file đã ghép thành công sẽ được lưu ở đây</p>
                        </div>
                    `;
                    return;
                }

                historyListContainer.innerHTML = history.map(item => {
                    const url = URL.createObjectURL(item.blob);
                    return `
                        <div class="history-item" data-id="${item.id}">
                            <div class="history-item-header">
                                <div class="history-item-name" title="${item.fileName}">${item.fileName}</div>
                                <div class="history-item-actions">
                                    <button class="history-item-action-btn history-item-play-btn" data-id="${item.id}" data-url="${url}">
                                        ▶️ Phát
                                    </button>
                                    <a href="${url}" download="${item.fileName}" class="history-item-action-btn history-item-download-btn">
                                        💾 Tải
                                    </a>
                                    <button class="history-item-action-btn history-item-delete-btn" data-id="${item.id}">
                                        🗑️ Xóa
                                    </button>
                                </div>
                            </div>
                            <div class="history-item-info">
                                <span>📅 ${formatTime(item.timestamp)}</span>
                                <span>📦 ${formatSize(item.size)}</span>
                                ${item.chunkCount ? `<span>🧩 ${item.chunkCount} chunks</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                // Event listeners cho các nút
                historyListContainer.querySelectorAll('.history-item-play-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const itemId = parseInt(e.target.dataset.id);
                        const url = e.target.dataset.url;
                        
                        // Dừng audio đang phát (nếu có)
                        if (currentPlayingAudio) {
                            currentPlayingAudio.pause();
                            currentPlayingAudio = null;
                        }

                        // Phát audio mới
                        currentPlayingAudio = new Audio(url);
                        currentPlayingAudio.play();
                        
                        // Cập nhật nút
                        e.target.textContent = '⏸️ Dừng';
                        e.target.classList.add('playing');
                        
                        currentPlayingAudio.onended = () => {
                            e.target.textContent = '▶️ Phát';
                            e.target.classList.remove('playing');
                            currentPlayingAudio = null;
                        };
                        
                        currentPlayingAudio.onpause = () => {
                            e.target.textContent = '▶️ Phát';
                            e.target.classList.remove('playing');
                        };
                    });
                });

                historyListContainer.querySelectorAll('.history-item-delete-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const itemId = parseInt(e.target.dataset.id);
                        try {
                            const db = window.historyDB || historyDB;
                            if (!db || typeof db.deleteHistoryItem !== 'function') {
                                throw new Error('HistoryDB chưa được khởi tạo. Vui lòng tải lại trang.');
                            }
                            await db.deleteHistoryItem(itemId);
                            renderHistory(); // Render lại danh sách
                            if (typeof addLogEntry === 'function') {
                                addLogEntry('🗑️ Đã xóa file khỏi lịch sử', 'success');
                            }
                        } catch (error) {
                            console.error('Lỗi xóa file:', error);
                            const errorMsg = error.message || 'Lỗi khi xóa file!';
                            if (typeof addLogEntry === 'function') {
                                addLogEntry(`❌ ${errorMsg}`, 'error');
                            } else {
                                alert(errorMsg);
                            }
                        }
                    });
                });
            } catch (error) {
                console.error('Lỗi render lịch sử:', error);
                historyListContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #f55;">
                        <p>❌ Lỗi khi tải lịch sử: ${error.message}</p>
                    </div>
                `;
            }
        }

        // Mở modal lịch sử
        if (openHistoryBtn && historyModal) {
            openHistoryBtn.addEventListener('click', async () => {
                // QUAN TRỌNG: Di chuyển modal ra body level để đảm bảo tính từ viewport
                if (historyModal.parentElement && historyModal.parentElement.tagName !== 'BODY') {
                    const originalParent = historyModal.parentElement;
                    document.body.appendChild(historyModal);
                    if (typeof addLogEntry === 'function') {
                        addLogEntry('🔄 Đã di chuyển modal lịch sử ra body level để hiển thị đầy đủ', 'info');
                    }
                }
                
                // Đảm bảo modal được hiển thị đúng cách và căn giữa từ viewport
                historyModal.style.position = 'fixed';
                historyModal.style.top = '0';
                historyModal.style.left = '0';
                historyModal.style.right = '0';
                historyModal.style.bottom = '0';
                historyModal.style.width = '100vw';
                historyModal.style.height = '100vh';
                historyModal.style.margin = '0';
                historyModal.style.padding = '0';
                historyModal.style.display = 'flex';
                historyModal.style.visibility = 'visible';
                historyModal.style.opacity = '1';
                historyModal.style.zIndex = '10001';
                historyModal.style.alignItems = 'center';
                historyModal.style.justifyContent = 'center';
                
                await renderHistory();
            });
        }

        // Đóng modal lịch sử
        const closeHistoryModal = () => {
            if (historyModal) {
                historyModal.style.display = 'none';
                // Dừng audio đang phát
                if (currentPlayingAudio) {
                    currentPlayingAudio.pause();
                    currentPlayingAudio = null;
                }
            }
        };

        if (closeHistoryBtn && historyModal) {
            closeHistoryBtn.addEventListener('click', closeHistoryModal);
        }

        // Đóng modal khi click vào background
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    closeHistoryModal();
                }
            });
        }

        // Xóa tất cả lịch sử
        if (clearAllHistoryBtn) {
            clearAllHistoryBtn.addEventListener('click', async () => {
                try {
                    // Kiểm tra historyDB đã được khởi tạo chưa (ưu tiên window.historyDB)
                    const db = window.historyDB || historyDB;
                    if (!db || typeof db.clearAllHistory !== 'function') {
                        throw new Error('HistoryDB chưa được khởi tạo. Vui lòng tải lại trang.');
                    }
                    
                    await db.clearAllHistory();
                    await renderHistory();
                    if (typeof addLogEntry === 'function') {
                        addLogEntry('🗑️ Đã xóa tất cả lịch sử', 'success');
                    }
                } catch (error) {
                    console.error('Lỗi xóa lịch sử:', error);
                    const errorMsg = error.message || 'Lỗi khi xóa lịch sử!';
                    if (typeof addLogEntry === 'function') {
                        addLogEntry(`❌ ${errorMsg}`, 'error');
                    } else {
                        alert(errorMsg);
                    }
                }
            });
        }
    }
    
    // Khởi tạo history modal sau khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHistoryModal);
    } else {
        // DOM đã sẵn sàng, nhưng có thể HTML chưa được inject
        setTimeout(initHistoryModal, 100);
    }

    // Lắng nghe sự kiện beforeunload để dọn dẹp
    window.addEventListener('beforeunload', () => {
        stopAutoReset403();
        if (errorObserver) {
            errorObserver.disconnect();
        }
    });
