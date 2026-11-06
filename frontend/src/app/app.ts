import { Component } from '@angular/core';
import { Mission } from './ui/mission';

@Component({
  selector: 'app-root',
  imports: [Mission],
  template: '<app-mission />',
})
export class App {}
