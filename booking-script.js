document.addEventListener('DOMContentLoaded', function() {
    // --- Lấy các phần tử từ DOM ---
    const bookingForm = document.getElementById('bookingForm');
    const scriptUrl = bookingForm.action; // Lấy URL của Apps Script từ action của form
    const submitButton = document.getElementById('submitButton');
    const submitBtnText = document.getElementById('submitBtnText');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const phoneInput = document.getElementById('phone');
    const phoneValidation = document.getElementById('phoneValidation');
    const bookingDateField = document.getElementById('bookingDateTime');
    const serviceField = document.getElementById('service');
    const staffContainer = document.getElementById('staff-availability-container');
    const staffListEl = document.getElementById('staff-list');
    const staffLoading = document.getElementById('staff-loading');
    const endTimeDisplay = document.getElementById('end-time-display');
    const fullNameInput = document.getElementById('fullName');
    const masseuseInput = document.getElementById('masseuse');

    // --- Lấy múi giờ của trình duyệt ---
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // --- Thiết lập ngày giờ tối thiểu và tối đa cho ô input ---
    function setDateTimeLimits() {
        const now = new Date();
        const minDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        bookingDateField.min = minDate.toISOString().slice(0, 16);

        const maxDate = new Date(now);
        maxDate.setDate(now.getDate() + 10);
        const maxDateLocal = new Date(maxDate.getTime() - maxDate.getTimezoneOffset() * 60000);
        bookingDateField.max = maxDateLocal.toISOString().slice(0, 16);
    }
    setDateTimeLimits();

    // --- Xử lý sự kiện input cho các trường ---
    fullNameInput.addEventListener('input', function() { this.value = this.value.toUpperCase(); });
    phoneInput.addEventListener('input', function() {
        phoneValidation.style.display = /^[0-9]{8,15}$/.test(this.value) ? 'none' : 'block';
    });
    bookingDateField.addEventListener('input', fetchStaffAvailability);
    serviceField.addEventListener('change', fetchStaffAvailability);

    // --- HÀM GỌI API ĐỂ LẤY DANH SÁCH NHÂN VIÊN (DÙNG FETCH) ---
    async function fetchStaffAvailability() {
        const dateTimeValue = bookingDateField.value;
        const serviceValue = serviceField.value;

        if (!dateTimeValue || !serviceValue) {
            staffContainer.style.display = 'none';
            endTimeDisplay.textContent = '--:--';
            return;
        }

        staffContainer.style.display = 'block';
        staffListEl.innerHTML = '';
        staffLoading.style.display = 'block';
        staffLoading.innerHTML = '<p>Loading staff list...</p><p lang="zh-CN">正在加载员工列表...</p>';

        const isoDate = new Date(dateTimeValue);
        const bookingDate = `${('0' + isoDate.getDate()).slice(-2)}/${('0' + (isoDate.getMonth() + 1)).slice(-2)}/${isoDate.getFullYear()}`;
        const startTime = `${('0' + isoDate.getHours()).slice(-2)}:${('0' + isoDate.getMinutes()).slice(-2)}`;
        const serviceName = serviceField.options[serviceField.selectedIndex].text.split('(')[0].trim();
        
        // Xây dựng URL với các tham số cho yêu cầu GET
        const params = new URLSearchParams({
            action: 'getAvailableStaff',
            bookingDate: bookingDate,
            startTime: startTime,
            serviceName: serviceName,
            timezone: userTimeZone
        });
        
        const requestUrl = `${scriptUrl}?${params.toString()}`;

        try {
            const response = await fetch(requestUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Vì Apps Script trả về chuỗi JSON, ta cần parse nó
            const responseText = await response.text();
            const result = JSON.parse(responseText);

            if (result.status === 'success') {
                const data = result.data;
                endTimeDisplay.textContent = data.endTime;
                displayStaff(data.staffStatus);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error fetching staff availability:', error);
            staffLoading.style.display = 'block';
            staffListEl.innerHTML = '';
            staffLoading.innerHTML = `<p style="color:red;">Could not load staff list. Please check your selections and try again. <br>Error: ${error.message}</p>`;
        }
    }

    // --- HÀM HIỂN THỊ DANH SÁCH NHÂN VIÊN LÊN GIAO DIỆN ---
    function displayStaff(staffData) {
        staffLoading.style.display = 'none';
        staffListEl.innerHTML = ''; // Xóa danh sách cũ

        let noPreferenceItem = document.createElement('li');
        noPreferenceItem.className = 'staff-item';
        noPreferenceItem.innerHTML = `
            <input type="radio" id="staff-any" name="staffChoice" value="Any" checked>
            <label for="staff-any" class="staff-name">No Preference / <span lang="zh-CN">随便</span></label>`;
        staffListEl.appendChild(noPreferenceItem);

        if (!Array.isArray(staffData) || staffData.length === 0) {
            staffListEl.innerHTML += '<li>No staff data available.</li>';
            return;
        }
        
        staffData.forEach(staff => {
            const listItem = document.createElement('li');
            listItem.className = 'staff-item';
            let statusClass = 'status-busy';
            let statusText = staff.status;
            let isDisabled = true;

            if (statusText === 'OFF') {
                statusText = 'OFF / <span lang="zh-CN">休息</span>';
            } else if (statusText === 'Rảnh rỗi') {
                statusClass = 'status-available';
                statusText = 'Available / <span lang="zh-CN">空闲</span>';
                isDisabled = false;
            } else if (statusText.includes('Dự kiến rảnh lúc')) {
                statusText = statusText.replace('Dự kiến rảnh lúc', 'Busy until / <span lang="zh-CN">忙碌直到</span>');
            }
            
            const uniqueId = `staff-${staff.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
            listItem.innerHTML = `
                <input type="radio" id="${uniqueId}" name="staffChoice" value="${staff.name}" ${isDisabled ? 'disabled' : ''}>
                <label for="${uniqueId}" class="staff-name">${staff.name}</label>
                <span class="staff-status ${statusClass}">${statusText}</span>`;
            
            if (!isDisabled) {
                listItem.addEventListener('click', () => {
                    document.getElementById(uniqueId).checked = true;
                });
            }
            staffListEl.appendChild(listItem);
        });
    }
    
    // --- XỬ LÝ SỰ KIỆN SUBMIT FORM (DÙNG FETCH) ---
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // --- Validation ---
        if (!/^[0-9]{8,15}$/.test(phoneInput.value)) { phoneValidation.style.display = 'block'; return; }
        const selectedDate = new Date(bookingDateField.value);
        const now = new Date();
        const tenDaysLater = new Date(); tenDaysLater.setDate(now.getDate() + 10);
        if (selectedDate < now || selectedDate > tenDaysLater) { errorMessageDiv.style.display = 'block'; return; }
        const hours = selectedDate.getHours();
        if (hours < 9 || hours > 22 || (hours === 22 && selectedDate.getMinutes() > 30)) { errorMessageDiv.style.display = 'block'; return; }
        errorMessageDiv.style.display = 'none';

        // --- Cập nhật UI ---
        submitButton.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        submitBtnText.innerHTML = 'Sending... / <span lang="zh-CN">正在发送...</span>';

        // --- Chuẩn bị dữ liệu để gửi đi ---
        const selectedStaffRadio = document.querySelector('input[name="staffChoice"]:checked');
        const preferredStaffName = selectedStaffRadio ? selectedStaffRadio.value : 'Any';
        const isoDate = new Date(bookingDateField.value);
        const bookingTimeForBackend = `${('0' + isoDate.getHours()).slice(-2)}:${('0' + isoDate.getMinutes()).slice(-2)} ${('0' + isoDate.getDate()).slice(-2)}/${('0' + (isoDate.getMonth() + 1)).slice(-2)}/${isoDate.getFullYear()}`;
        const serviceNameForBackend = serviceField.options[serviceField.selectedIndex].text.split('(')[0].trim();
        
        // Dùng FormData để gửi lên server
        const formData = new FormData();
        formData.append('FullName', fullNameInput.value);
        formData.append('BookingDateTime', bookingTimeForBackend);
        formData.append('Service', serviceNameForBackend);
        formData.append('PreferredStaff', preferredStaffName);
        formData.append('PhoneNumber', phoneInput.value);
        formData.append('timezone', userTimeZone);

        // --- Gửi dữ liệu bằng fetch POST ---
        fetch(scriptUrl, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    document.getElementById('confirm_name').innerText = formData.get('FullName');
                    document.getElementById('confirm_datetime').innerText = `${isoDate.toLocaleString()}`;
                    document.getElementById('confirm_service').innerText = serviceField.options[serviceField.selectedIndex].text;
                    document.getElementById('confirm_phone').innerText = formData.get('PhoneNumber');
                    document.getElementById('confirm_masseuse').innerText = preferredStaffName;
                    bookingForm.style.display = 'none';
                    document.getElementById('form-description').style.display = 'none';
                    successMessageDiv.style.display = 'block';
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            })
            .finally(() => {
                submitButton.disabled = false;
                loadingSpinner.style.display = 'none';
                submitBtnText.innerHTML = 'Send Booking Request / <span lang="zh-CN">发送预约请求</span>';
            });
    });
});
