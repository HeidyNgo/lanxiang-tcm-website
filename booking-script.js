// Lấy các phần tử từ DOM
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
const staffList = document.getElementById('staff-list');
const staffLoading = document.getElementById('staff-loading');
const endTimeDisplay = document.getElementById('end-time-display');
const fullNameInput = document.getElementById('fullName');
const masseuseInput = document.getElementById('masseuse');

// Xử lý sự kiện input cho phone number
phoneInput.addEventListener('input', function() {
    const isValid = /^[0-9]{8,15}$/.test(this.value);
    phoneValidation.style.display = isValid ? 'none' : 'block';
});

// Xử lý sự kiện submit form
bookingForm.addEventListener('submit', function(e) {
    e.preventDefault();
    errorMessageDiv.style.display = 'none';

    const phoneValid = /^[0-9]{8,15}$/.test(phoneInput.value);
    if (!phoneValid) {
        phoneValidation.style.display = 'block';
        return;
    } else {
        phoneValidation.style.display = 'none';
    }

    const dateTimeValue = bookingDateField.value;
    if (!dateTimeValue) {
        alert("Please select a valid date and time");
        return;
    }
    
    const selectedDate = new Date(dateTimeValue);
    const now = new Date('2025-06-17T20:54:00+07:00'); // Thời gian hiện tại
    
    const tenDaysLater = new Date(now);
    tenDaysLater.setDate(now.getDate() + 10);
    tenDaysLater.setHours(23, 59, 59, 999);

    if (selectedDate > tenDaysLater || selectedDate < now) {
        errorMessageDiv.style.display = 'block';
        return;
    }
    
    const hours = selectedDate.getHours();
    const minutes = selectedDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes < 540 || totalMinutes > 1350) { // 9:00 AM to 10:30 PM
        errorMessageDiv.style.display = 'block';
        return;
    }
    
    submitButton.disabled = true;
    loadingSpinner.style.display = 'inline-block';
    submitBtnText.innerHTML = 'Sending... / <span lang="zh-CN">正在发送...</span>';
    
    const selectedStaffRadio = document.querySelector('input[name="staffChoice"]:checked');
    const preferredStaffName = selectedStaffRadio ? selectedStaffRadio.value : '';
    masseuseInput.value = preferredStaffName;

    const formData = new URLSearchParams();
    formData.append('FullName', fullNameInput.value);
    formData.append('BookingDateTime', dateTimeValue);
    formData.append('Service', serviceField.value);
    formData.append('PreferredStaff', preferredStaffName || '');
    formData.append('PhoneNumber', phoneInput.value);

    fetch(bookingForm.action, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            const fullName = fullNameInput.value;
            const service = serviceField.options[serviceField.selectedIndex].text;
            const formattedDateTime = `${('0' + selectedDate.getDate()).slice(-2)}/${('0' + (selectedDate.getMonth() + 1)).slice(-2)}/${selectedDate.getFullYear()} ${('0' + selectedDate.getHours()).slice(-2)}:${('0' + selectedDate.getMinutes()).slice(-2)}`;

            document.getElementById('confirm_name').innerText = fullName;
            document.getElementById('confirm_datetime').innerText = formattedDateTime;
            document.getElementById('confirm_service').innerText = service;
            document.getElementById('confirm_phone').innerText = phoneInput.value;
            document.getElementById('confirm_masseuse').innerText = preferredStaffName || 'None';

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

// Xử lý input chữ cái thành chữ in hoa
fullNameInput.addEventListener('input', function() { 
    this.value = this.value.toUpperCase(); 
});

// Thiết lập min và max cho datetime-local
const nowPicker = new Date('2025-06-17T20:54:00+07:00');
const datetimeInput = document.getElementById('bookingDateTime');

datetimeInput.min = new Date(nowPicker.getTime() - nowPicker.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const maxDate = new Date(nowPicker);
maxDate.setDate(nowPicker.getDate() + 10);
datetimeInput.max = new Date(maxDate.getTime() - maxDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// Thêm logic để tính end time và gọi danh sách nhân viên
document.addEventListener('DOMContentLoaded', function() {
    async function fetchStaffAvailability() {
        const dateTimeValue = bookingDateField.value;
        const serviceValue = serviceField.value;

        if (!dateTimeValue || !serviceValue) {
            staffContainer.style.display = 'none';
            endTimeDisplay.textContent = '--:--';
            return;
        }

        staffContainer.style.display = 'block';
        staffList.innerHTML = '';
        staffLoading.style.display = 'block';
        staffLoading.innerHTML = '<p>Loading staff list...</p><p lang="zh-CN">正在加载员工列表...</p>';

        try {
            const isoDate = new Date(dateTimeValue);
            const formattedDate = `${('0' + isoDate.getDate()).slice(-2)}/${('0' + (isoDate.getMonth() + 1)).slice(-2)}/${isoDate.getFullYear()}`;
            const startTime = `${('0' + isoDate.getHours()).slice(-2)}:${('0' + isoDate.getMinutes()).slice(-2)}`;

            // Tính duration từ service
            const durationMatch = serviceValue.match(/\d+\s*mins/);
            let duration = 60; // Default 60 minutes
            if (durationMatch) {
                duration = parseInt(durationMatch[0]);
            }

            // Tính end time
            const startDate = new Date(isoDate);
            const endDate = new Date(startDate.getTime() + duration * 60000);
            const formattedEndTime = `${('0' + endDate.getHours()).slice(-2)}:${('0' + endDate.getMinutes()).slice(-2)}`;
            endTimeDisplay.textContent = formattedEndTime;

            // Gọi API để lấy danh sách nhân viên
            const response = await fetch(`${bookingForm.action}?date=${encodeURIComponent(formattedDate)}&startTime=${encodeURIComponent(startTime)}&duration=${duration}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Failed to fetch staff data');

            const data = await response.json();
            displayStaff(data.staffStatus);
        } catch (error) {
            console.error('Error fetching staff availability:', error);
            staffLoading.style.display = 'block';
            staffList.innerHTML = '';
            staffLoading.innerHTML = `<p style="color:red;">Could not load staff list. Please try again.</p>`;
        }
    }

    function displayStaff(staffList) {
        staffLoading.style.display = 'none';
        staffList.innerHTML = '';

        // Add "No Preference" option
        const noPreferenceItem = document.createElement('li');
        noPreferenceItem.className = 'staff-item';
        noPreferenceItem.innerHTML = `
            <input type="radio" id="staff-none" name="staffChoice" value="" checked>
            <label for="staff-none" class="staff-name">No Preference / 随便</label>
        `;
        noPreferenceItem.onclick = () => document.getElementById('staff-none').checked = true;
        staffList.appendChild(noPreferenceItem);

        staffList.forEach(staff => {
            const listItem = document.createElement('li');
            listItem.className = 'staff-item';

            let statusClass, statusText;
            if (staff.status.includes('OFF')) {
                statusClass = 'status-busy';
                statusText = 'Off / 休息';
            } else if (staff.status.includes('Rảnh') || staff.status.includes('Free')) {
                statusClass = 'status-available';
                statusText = 'Available / 空闲';
            } else {
                statusClass = 'status-busy';
                statusText = staff.status.replace('Bận đến', 'Busy until').replace('đến', 'until') + ' / 忙碌';
            }

            const uniqueId = `staff-${staff.name.replace(/\s+/g, '-')}`;
            listItem.innerHTML = `
                <input type="radio" id="${uniqueId}" name="staffChoice" value="${staff.name}" ${statusClass === 'status-busy' ? 'disabled' : ''}>
                <label for="${uniqueId}" class="staff-name">${staff.name}</label>
                <span class="staff-status ${statusClass}">${statusText}</span>
            `;
            listItem.onclick = () => document.getElementById(uniqueId).checked = true;

            staffList.appendChild(listItem);
        });
    }

    // Thêm event listener cho datetime và service
    bookingDateField.addEventListener('input', fetchStaffAvailability);
    serviceField.addEventListener('change', fetchStaffAvailability);
});
