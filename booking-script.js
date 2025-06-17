// =======================================================
//          BOOKING-SCRIPT.JS - PHIÊN BẢN NÂNG CẤP
// =======================================================

document.addEventListener('DOMContentLoaded', function() {
    // --- Lấy các phần tử từ DOM ---
    const bookingForm = document.getElementById('bookingForm');
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

    // --- HÀM GỌI API ĐỂ LẤY DANH SÁCH NHÂN VIÊN ---
    function fetchStaffAvailability() {
        const dateTimeValue = bookingDateField.value;
        const serviceValue = serviceField.value;

        // Chỉ chạy khi cả ngày giờ và dịch vụ đã được chọn
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
        
        // Lấy tên dịch vụ sạch (bỏ giá tiền)
        const serviceName = serviceField.options[serviceField.selectedIndex].text.split('(')[0].trim();

        // Dùng google.script.run để gọi hàm Apps Script một cách an toàn
        google.script.run
            .withSuccessHandler(handleStaffFetchSuccess)
            .withFailureHandler(handleStaffFetchError)
            .getAvailableStaff({
                bookingDate: bookingDate,
                startTime: startTime,
                serviceName: serviceName, // Gửi tên dịch vụ sạch
                timezone: userTimeZone
            });
    }

    // --- HÀM XỬ LÝ KHI LẤY DANH SÁCH NHÂN VIÊN THÀNH CÔNG ---
    function handleStaffFetchSuccess(responseString) {
        staffLoading.style.display = 'none';
        staffListEl.innerHTML = '';
        
        try {
            const response = JSON.parse(responseString);
            if (response.status === 'success') {
                const data = response.data;
                endTimeDisplay.textContent = data.endTime; // Cập nhật giờ kết thúc
                displayStaff(data.staffStatus);      // Hiển thị danh sách nhân viên
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            handleStaffFetchError(error);
        }
    }

    // --- HÀM XỬ LÝ KHI LẤY DANH SÁCH NHÂN VIÊN THẤT BẠI ---
    function handleStaffFetchError(error) {
        console.error('Error fetching staff availability:', error);
        staffLoading.style.display = 'block';
        staffListEl.innerHTML = '';
        staffLoading.innerHTML = `<p style="color:red;">Could not load staff list. Please check your selections and try again. <br>Error: ${error.message}</p>`;
    }

    // --- HÀM HIỂN THỊ DANH SÁCH NHÂN VIÊN LÊN GIAO DIỆN ---
    function displayStaff(staffData) {
        staffListEl.innerHTML = ''; // Xóa danh sách cũ

        // Luôn thêm lựa chọn "Không ưu tiên"
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
            
            // Cho phép click vào cả dòng để chọn
            if (!isDisabled) {
                listItem.addEventListener('click', () => {
                    document.getElementById(uniqueId).checked = true;
                });
            }

            staffListEl.appendChild(listItem);
        });
    }
    
    // --- XỬ LÝ SỰ KIỆN SUBMIT FORM ---
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // --- Kiểm tra hợp lệ ---
        if (!/^[0-9]{8,15}$/.test(phoneInput.value)) {
            phoneValidation.style.display = 'block';
            return;
        }
        const selectedDate = new Date(bookingDateField.value);
        const now = new Date();
        const tenDaysLater = new Date();
        tenDaysLater.setDate(now.getDate() + 10);
        
        if (selectedDate < now || selectedDate > tenDaysLater) {
            errorMessageDiv.style.display = 'block';
            return;
        }
        const hours = selectedDate.getHours();
        if (hours < 9 || hours > 22 || (hours === 22 && selectedDate.getMinutes() > 30)) {
            errorMessageDiv.style.display = 'block';
            return;
        }
        errorMessageDiv.style.display = 'none';

        // --- Vô hiệu hóa nút bấm, hiển thị spinner ---
        submitButton.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        submitBtnText.innerHTML = 'Sending... / <span lang="zh-CN">正在发送...</span>';

        // --- Chuẩn bị dữ liệu để gửi đi ---
        const selectedStaffRadio = document.querySelector('input[name="staffChoice"]:checked');
        const preferredStaffName = selectedStaffRadio ? selectedStaffRadio.value : 'Any';
        masseuseInput.value = preferredStaffName;

        const isoDate = new Date(bookingDateField.value);
        // Định dạng lại cho khớp với backend "HH:mm dd/MM/yyyy"
        const bookingTimeForBackend = `${('0' + isoDate.getHours()).slice(-2)}:${('0' + isoDate.getMinutes()).slice(-2)} ${('0' + isoDate.getDate()).slice(-2)}/${('0' + (isoDate.getMonth() + 1)).slice(-2)}/${isoDate.getFullYear()}`;
        const serviceNameForBackend = serviceField.options[serviceField.selectedIndex].text.split('(')[0].trim();

        const formData = {
            FullName: fullNameInput.value,
            BookingDateTime: bookingTimeForBackend,
            Service: serviceNameForBackend,
            PreferredStaff: preferredStaffName,
            PhoneNumber: phoneInput.value,
            timezone: userTimeZone
        };

        // --- Gửi dữ liệu bằng google.script.run ---
        google.script.run
            .withSuccessHandler(function(responseString) {
                const data = JSON.parse(responseString);
                if (data.status === 'success') {
                    document.getElementById('confirm_name').innerText = formData.FullName;
                    document.getElementById('confirm_datetime').innerText = `${isoDate.toLocaleString()}`;
                    document.getElementById('confirm_service').innerText = serviceField.options[serviceField.selectedIndex].text;
                    document.getElementById('confirm_phone').innerText = formData.PhoneNumber;
                    document.getElementById('confirm_masseuse').innerText = formData.PreferredStaff;
                    
                    bookingForm.style.display = 'none';
                    document.getElementById('form-description').style.display = 'none';
                    successMessageDiv.style.display = 'block';
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .withFailureHandler(function(error) {
                console.error('Error:', error);
                alert('An error occurred. Please try again. Error: ' + error.message);
            })
            .withFinally(function() {
                submitButton.disabled = false;
                loadingSpinner.style.display = 'none';
                submitBtnText.innerHTML = 'Send Booking Request / <span lang="zh-CN">发送预约请求</span>';
            })
            .doPost({ parameter: formData }); // Gửi đi dưới dạng object mà doPost có thể đọc
    });
});
