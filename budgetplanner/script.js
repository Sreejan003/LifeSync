// ===============================
// TAB NAVIGATION
// ===============================

const navButtons = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".tab-panel");

function activateTab(tab) {

  panels.forEach(panel => {
    panel.classList.toggle(
      "active",
      panel.id === tab
    );
  });

  navButtons.forEach(button => {

    const active = button.dataset.tab === tab;

    button.classList.toggle(
      "nav-active",
      active
    );

    if (!active) {
      button.classList.add(
        "text-slate-600",
        "dark:text-slate-300"
      );
    } else {
      button.classList.remove(
        "text-slate-600",
        "dark:text-slate-300"
      );
    }

  });

  document
    .getElementById("sidebar")
    .classList.add("-translate-x-full");

  document
    .getElementById("backdrop")
    .classList.add("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


navButtons.forEach(button => {

  button.addEventListener(
    "click",
    () => activateTab(button.dataset.tab)
  );

});


document.querySelectorAll(".nav-jump").forEach(button => {

  button.addEventListener(
    "click",
    () => activateTab(button.dataset.tab)
  );

});


// ===============================
// MOBILE SIDEBAR
// ===============================

document.getElementById("menuBtn").onclick = () => {

  document
    .getElementById("sidebar")
    .classList.remove("-translate-x-full");

  document
    .getElementById("backdrop")
    .classList.remove("hidden");

};


document.getElementById("backdrop").onclick = () => {

  document
    .getElementById("sidebar")
    .classList.add("-translate-x-full");

  document
    .getElementById("backdrop")
    .classList.add("hidden");

};


// ===============================
// DARK MODE
// ===============================

const savedTheme =
  localStorage.getItem("budget-theme");

if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}


document.getElementById("darkToggle").onclick = () => {

  document.documentElement.classList.toggle("dark");

  localStorage.setItem(
    "budget-theme",
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

};


// ===============================
// FINANCIAL RUNWAY
// ===============================

const sumInput =
  document.getElementById("sumInput");

const bufferRange =
  document.getElementById("bufferRange");

const bufferLabel =
  document.getElementById("bufferLabel");

const monthlyCap =
  document.getElementById("monthlyCap");

const runwayTotal =
  document.getElementById("runwayTotal");

const monthBars =
  document.getElementById("monthBars");


function money(number) {

  return "₹" +
    Math.round(number)
      .toLocaleString("en-IN");

}


function renderRunway() {

  const total =
    Math.max(
      0,
      Number(sumInput.value) || 0
    );

  const buffer =
    Number(bufferRange.value);

  const usable =
    total * (1 - buffer / 100);

  const base =
    usable / 4;

  const weights = [
    1.08,
    1.0,
    0.92,
    1.0
  ];

  const raw =
    weights.map(weight => base * weight);

  const scale =
    usable /
    raw.reduce(
      (a, b) => a + b,
      0
    );

  const values =
    raw.map(value => value * scale);


  bufferLabel.textContent =
    buffer + "%";

  monthlyCap.textContent =
    money(base);

  runwayTotal.textContent =
    money(total);


  monthBars.innerHTML =
    values.map((value, index) => {

      const height =
        Math.max(
          18,
          Math.round(
            value /
            Math.max(...values) *
            100
          )
        );

      const months = [
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ];

      return `
        <div class="flex flex-col justify-end h-full">

          <div class="
            text-center
            text-xs
            text-slate-400
            mb-2
          ">
            ${money(value)}
          </div>

          <div
            class="
              rounded-t-xl
              bg-gradient-to-t
              from-violet-600
              to-fuchsia-400
            "
            style="height:${height}%">
          </div>

          <div
            class="
              text-xs
              mt-2
              text-center
              text-slate-400
            ">
            ${months[index]}
          </div>

        </div>
      `;

    }).join("");

}


sumInput.addEventListener(
  "input",
  renderRunway
);

bufferRange.addEventListener(
  "input",
  renderRunway
);

renderRunway();


// ===============================
// PEER BENCHMARK
// ===============================

const benchmarkData = [

  ["Food", 1800, 2200],

  ["Transport", 700, 950],

  ["Entertainment", 520, 760],

  ["Study", 900, 800],

  ["Shopping", 640, 980]

];


document.getElementById(
  "benchmarkList"
).innerHTML = benchmarkData.map(
  ([name, you, peer]) => {

    const max =
      Math.max(you, peer);

    const pctYou =
      you / max * 100;

    const pctPeer =
      peer / max * 100;

    const lower =
      you < peer;


    return `
      <div>

        <div
          class="
            flex
            justify-between
            text-sm
            mb-2
          ">

          <b>${name}</b>

          <span
            class="
              ${lower
                ? "text-emerald-600"
                : "text-orange-600"}
              font-semibold
            ">

            ${
              lower
                ? "₹" + (peer - you) + " below"
                : "₹" + (you - peer) + " above"
            }

            average

          </span>

        </div>


        <div class="space-y-2">

          <!-- USER -->

          <div class="
            flex
            items-center
            gap-3
          ">

            <span class="
              w-12
              text-xs
              text-slate-400
            ">
              You
            </span>

            <div class="
              flex-1
              h-3
              rounded-full
              bg-slate-100
              dark:bg-white/10
              overflow-hidden
            ">

              <div
                class="
                  h-full
                  rounded-full
                  bg-violet-500
                "
                style="width:${pctYou}%">
              </div>

            </div>

            <b class="
              w-14
              text-right
              text-sm
            ">
              ₹${you}
            </b>

          </div>


          <!-- PEERS -->

          <div class="
            flex
            items-center
            gap-3
          ">

            <span class="
              w-12
              text-xs
              text-slate-400
            ">
              Peers
            </span>

            <div class="
              flex-1
              h-3
              rounded-full
              bg-slate-100
              dark:bg-white/10
              overflow-hidden
            ">

              <div
                class="
                  h-full
                  rounded-full
                  bg-slate-300
                  dark:bg-slate-600
                "
                style="width:${pctPeer}%">
              </div>

            </div>

            <b class="
              w-14
              text-right
              text-sm
              text-slate-400
            ">
              ₹${peer}
            </b>

          </div>

        </div>

      </div>
    `;

  }
).join("");


// ===============================
// LATE NIGHT FOOD SAFE
// ===============================

let nightSpent = 112;

let nightLocked = false;

const nightLimit = 350;


function updateNight() {

  document.getElementById(
    "nightAmount"
  ).textContent =
    money(
      Math.max(
        0,
        nightLimit - nightSpent
      )
    );


  document.getElementById(
    "nightBar"
  ).style.width =
    Math.min(
      100,
      nightSpent / nightLimit * 100
    ) + "%";


  document.getElementById(
    "lockIcon"
  ).textContent =
    nightLocked
      ? "🔒"
      : "🔓";


  document.getElementById(
    "lockBtn"
  ).textContent =
    nightLocked
      ? "🔓 Unlock wallet"
      : "🔒 Lock wallet";

}


function toggleLock() {

  nightLocked =
    !nightLocked;


  showToast(
    nightLocked
      ? "Wallet locked 🔒 No more late-night spending."
      : "Wallet unlocked 🔓"
  );


  updateNight();

}


function nightSpend(amount) {

  if (nightLocked) {

    showToast(
      "Wallet is locked. Tomorrow-you says thanks! 🌙"
    );

    return;
  }


  if (
    nightSpent + amount >
    nightLimit
  ) {

    showToast(
      "That would break tonight's limit 🚫"
    );

    return;
  }


  nightSpent += amount;

  updateNight();


  showToast(
    `₹${amount} spent. ${
      money(nightLimit - nightSpent)
    } left.`
  );

}


// ===============================
// BILL SPLITTER
// ===============================

function splitBill() {

  const bill =
    Number(
      document.getElementById("bill").value
    ) || 0;


  const people =
    Math.max(
      1,
      Number(
        document.getElementById("people").value
      ) || 1
    );


  document.getElementById(
    "splitResult"
  ).textContent =
    money(
      bill / people
    );


  showToast(
    "Bill split updated ✓"
  );

}


// ===============================
// TOAST MESSAGE
// ===============================

function showToast(message) {

  const toast =
    document.getElementById("toast");


  toast.textContent =
    message;


  toast.classList.add("show");


  clearTimeout(
    window.toastTimer
  );


  window.toastTimer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, 2500);

}


// Initial state
updateNight();