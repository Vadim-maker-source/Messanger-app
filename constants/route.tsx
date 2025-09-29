import { faComment } from "@fortawesome/free-solid-svg-icons";

  export const bottombarNavigation = [
      {
          id: 1,
          title: "Чаты",
          icon: faComment,
          link: "/"
      }
  ]
  
  export function renderWordMembers(count: number): string {
    if (count === 0) return 'участников';
    
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return 'участников';
    }
    
    if (lastDigit === 1) {
        return 'участник';
    }
    
    if (lastDigit >= 2 && lastDigit <= 4) {
        return 'участника';
    }
    
    return 'участников';
}