
// Автоматически подхватываем тему с основного сайта
(function () {
    // 1. Сначала пытаемся взять из localStorage (как у тебя на сайте)
    const savedTheme = localStorage.getItem('theme'); // ← у тебя точно так называется?
    
    // 2. Если в localStorage ничего нет — смотрим системную тему пользователя
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 3. Определяем финальную тему
    let currentTheme = 'dark'; // по умолчанию тёмная
    if (savedTheme === 'light') {
        currentTheme = 'light';
    } else if (savedTheme === 'dark') {
        currentTheme = 'dark';
    } else if (systemDark) {
        currentTheme = 'dark';
    } else {
        currentTheme = 'light';
    }

    // 4. Применяем к <html>
    document.documentElement.setAttribute('data-theme', currentTheme);
})();
