import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';


export interface Nomenclature {
  person: string;
  organization: string;
  firstName: string;
  middleName: string;
  lastName: string;
  companyName: string;
  dbaName: string;
  employeeCount: string;
  projects: string;
  capabilities: string;
  title: string;
  status: string;
  vip: string;
  email: string;
  phone: string;
  address: string;
  onlinePresence: string;
  nickname: string;
  birthday: string;
  anniversary: string;
  gender: string;
  category: string;
  timezone: string;
  businessType: string;
  task: string; // for renaming to “job”
  survey: string; // for renaming to “questions”
  lead: string;
  qualification: string;
  engaged: string;
  proposal: string;
  negotiation: string;
  closing: string;
  post: string;
  closed: string;
  [key: string]: string | undefined; // 👈 critical for template binding AND spread

}

@Injectable( {
  providedIn: 'root'
} )
export class NomenclatureService {

  private nomenclature: { [key: string]: Nomenclature; } = {
    contacts: {
      person: 'Contact',
      organization: 'Company',
      firstName: 'First Name',
      middleName: 'Middle Name',
      lastName: 'Last Name',
      companyName: 'Company Name',
      dbaName: 'DBA Name',
      employeeCount: 'Number of Employees',
      projects: 'Projects',
      capabilities: 'Capabilities',
      title: 'Title or Profession',
      status: 'Status',
      vip: 'VIP/Important',
      email: 'Email Address',
      phone: 'Phone Number',
      address: 'Address',
      onlinePresence: 'Online Presence',
      nickname: 'Nickname',
      birthday: 'Birthday',
      anniversary: 'Anniversary',
      gender: 'Gender',
      category: 'Category',
      timezone: 'Timezone',
      businessType: 'Business Type',
      task: 'Task',
      survey: 'Survey',
      lead: 'Lead',
      qualification: 'Qualification',
      engaged: 'Engaged',
      proposal: 'Proposal',
      negotiation: 'Negotiation',
      closing: 'Closing',
      post: 'Post Sale',
      closed: 'Closed Won',

    },
    lms: {
      person: 'Student',
      organization: 'Campus',
      firstName: 'First Name',
      middleName: 'Middle Name',
      lastName: 'Last Name',
      companyName: 'Institution Name',
      dbaName: 'Alias',
      employeeCount: 'Class Size',
      projects: 'Assignments',
      capabilities: 'Skills',
      title: 'Role',
      status: 'Enrollment Status',
      vip: 'Priority',
      email: 'Email Address',
      phone: 'Phone Number',
      address: 'Home Address',
      onlinePresence: 'Profile Links',
      nickname: 'Nickname',
      birthday: 'Birthday',
      anniversary: 'Enrollment Date',
      gender: 'Gender',
      category: 'Group',
      timezone: 'Time Zone',
      businessType: 'Institution Type',
      task: 'Task',
      survey: 'Quiz',
      lead: '',
      qualification: '',
      engaged: '',
      proposal: '',
      negotiation: '',
      closing: '',
      post: '',
      closed: '',

    },
    lis: {
      person: 'Patient',
      organization: 'Lab',
      firstName: 'First Name',
      middleName: 'Middle Name',
      lastName: 'Last Name',
      companyName: 'Lab Name',
      dbaName: 'Facility Alias',
      employeeCount: 'Lab Staff',
      projects: 'Test Batches',
      capabilities: 'Testing Capabilities',
      title: 'Medical Title',
      status: 'Health Status',
      vip: 'Critical Case',
      email: 'Email Address',
      phone: 'Phone Number',
      address: 'Patient Address',
      onlinePresence: 'EMR Access',
      nickname: 'Nickname',
      birthday: 'Date of Birth',
      anniversary: 'Intake Date',
      gender: 'Gender',
      category: 'Patient Category',
      timezone: 'Time Zone',
      businessType: 'Lab Type',
      task: 'Procedure',
      survey: 'Questionnaire',
      lead: '',
      qualification: '',
      engaged: '',
      proposal: '',
      negotiation: '',
      closing: '',
      post: '',
      closed: '',

    }
  };

  constructor () { }

  private currentSystemSubject: BehaviorSubject<string> = new BehaviorSubject<string>( 'contacts' );
  currentSystem$: Observable<string> = this.currentSystemSubject.asObservable();

  private currentNomenclatureSubject: BehaviorSubject<Nomenclature> = new BehaviorSubject<Nomenclature>( this.nomenclature['contacts'] );
  currentNomenclature$: Observable<Nomenclature> = this.currentNomenclatureSubject.asObservable();

  setSystem ( system: string ) {
    this.currentSystemSubject.next( system );
    this.currentNomenclatureSubject.next( this.nomenclature[system] );
  }

  getNomenclature ( category: keyof Nomenclature ): any {
    const currentSystem = this.currentSystemSubject.value;
    return this.nomenclature[currentSystem][category] ?? category;
  }


  updateNomenclature ( system: string, newNomenclature: Partial<Nomenclature> ) {
    this.nomenclature[system] = { ...this.nomenclature[system], ...newNomenclature };
    if ( this.currentSystemSubject.value === system ) {
      this.currentNomenclatureSubject.next( this.nomenclature[system] );
    }
  }

  public clearAll (): void {
    this.currentSystemSubject.next( 'contacts' );
    this.currentNomenclatureSubject.next( this.nomenclature['contacts'] );
  }
}
