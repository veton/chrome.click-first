export default class Utilities {
    static setClass(element, className, isPersent) {
        isPersent
            ? element.classList.add(className)
            : element.classList.remove(className);
    }
};
