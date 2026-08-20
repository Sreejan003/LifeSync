/* =========================
   ELEMENTS
========================= */

const calendarDays =
    document.getElementById("calendarDays");

const monthYear =
    document.getElementById("monthYear");

const prevBtn =
    document.getElementById("prevBtn");

const nextBtn =
    document.getElementById("nextBtn");

const selectedDateText =
    document.getElementById("selectedDate");

const reminderTitle =
    document.getElementById("reminderTitle");

const reminderDate =
    document.getElementById("reminderDate");

const reminderTime =
    document.getElementById("reminderTime");

const category =
    document.getElementById("category");

const priority =
    document.getElementById("priority");

const addReminderBtn =
    document.getElementById("addReminderBtn");


/* =========================
   DATE
========================= */

let currentDate = new Date();

let selectedDate = new Date();


/* =========================
   REMINDERS
========================= */

let reminders =
    JSON.parse(
        localStorage.getItem(
            "lifeSyncReminders"
        )
    ) || [];


/* =========================
   FORMAT DATE
========================= */

function formatDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/* =========================
   DISPLAY DATE
========================= */

function displayDate(date) {

    return date.toLocaleDateString(
        "en-US",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}


/* =========================
   RENDER CALENDAR
========================= */

function renderCalendar() {

    calendarDays.innerHTML = "";

    const year =
        currentDate.getFullYear();

    const month =
        currentDate.getMonth();


    monthYear.textContent =
        currentDate.toLocaleString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const totalDays =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    /* EMPTY BOXES */

    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        const empty =
            document.createElement("div");

        empty.classList.add("empty");

        calendarDays.appendChild(empty);
    }


    /* DATES */

    for (
        let day = 1;
        day <= totalDays;
        day++
    ) {

        const cell =
            document.createElement("div");


        const date =
            new Date(
                year,
                month,
                day
            );


        const dateString =
            formatDate(date);


        cell.innerHTML =
            `<span>${day}</span>`;


        /* TODAY */

        const today =
            new Date();


        if (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {

            cell.classList.add("today");
        }


        /* SELECTED DATE */

        if (
            dateString ===
            formatDate(selectedDate)
        ) {

            cell.classList.add("selected");
        }


        /* REMINDERS */

        const dayReminders =
            reminders.filter(
                reminder =>
                    reminder.date ===
                    dateString
            );


        dayReminders
            .slice(0, 2)
            .forEach(
                reminder => {

                    const event =
                        document.createElement(
                            "small"
                        );

                    event.className =
                        "event";

                    event.textContent =
                        reminder.title;

                    cell.appendChild(event);
                }
            );


        /* CLICK DATE */

        cell.addEventListener(
            "click",
            function() {

                selectedDate =
                    date;

                reminderDate.value =
                    dateString;

                updateSelectedDate();

                renderCalendar();
            }
        );


        calendarDays.appendChild(cell);
    }
}


/* =========================
   SELECTED DATE
========================= */

function updateSelectedDate() {

    selectedDateText.textContent =
        displayDate(
            selectedDate
        );
}


/* =========================
   PREVIOUS MONTH
========================= */

prevBtn.addEventListener(
    "click",
    function() {

        currentDate.setMonth(
            currentDate.getMonth() - 1
        );

        renderCalendar();
    }
);


/* =========================
   NEXT MONTH
========================= */

nextBtn.addEventListener(
    "click",
    function() {

        currentDate.setMonth(
            currentDate.getMonth() + 1
        );

        renderCalendar();
    }
);


/* =========================
   ADD REMINDER
========================= */

addReminderBtn.addEventListener(
    "click",
    function() {

        const title =
            reminderTitle.value.trim();

        const date =
            reminderDate.value;

        const time =
            reminderTime.value;


        if (
            title === "" ||
            date === ""
        ) {

            alert(
                "Please enter reminder title and date."
            );

            return;
        }


        const reminder = {

            id: Date.now(),

            title: title,

            date: date,

            time: time,

            category:
                category.value,

            priority:
                priority.value
        };


        reminders.push(reminder);


        localStorage.setItem(
            "lifeSyncReminders",
            JSON.stringify(reminders)
        );


        reminderTitle.value = "";

        reminderTime.value = "";


        alert(
            "Reminder added successfully! 🎉"
        );


        renderCalendar();

        updateSummary();
    }
);


/* =========================
   SUMMARY
========================= */

function updateSummary() {

    const today =
        formatDate(
            new Date()
        );


    const todayReminders =
        reminders.filter(
            reminder =>
                reminder.date === today
        );


    let study = 0;

    let assignment = 0;

    let exam = 0;


    todayReminders.forEach(
        reminder => {

            if (
                reminder.category ===
                "Study"
            ) {
                study++;
            }


            if (
                reminder.category ===
                "Assignment"
            ) {
                assignment++;
            }


            if (
                reminder.category ===
                "Exam"
            ) {
                exam++;
            }
        }
    );


    document.getElementById(
        "studyCount"
    ).textContent = study;


    document.getElementById(
        "assignmentCount"
    ).textContent = assignment;


    document.getElementById(
        "examCount"
    ).textContent = exam;
}


/* =========================
   INITIAL LOAD
========================= */

reminderDate.value =
    formatDate(selectedDate);

updateSelectedDate();

renderCalendar();

updateSummary();
