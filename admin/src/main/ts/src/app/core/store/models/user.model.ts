import {Model} from 'entcore-toolkit';
import {UserDetailsModel} from './userdetails.model';
import {globalStore} from '../global.store';
import {GroupModel} from './group.model';

export interface Classe {
    id: string;
    name: string;
    externalId: string;
}

export class UserModel extends Model<UserModel> {

    constructor() {
        super({
            create: '/directory/api/user',
            delete: '/directory/user'
        });
        this.userDetails = new UserDetailsModel();
    }

    private _id: string;
    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
        this.userDetails.id = id;
    }

    type: string;
    code: string;
    login: string;
    firstName: string;
    lastName: string;
    displayName: string;
    source: string;
    blocked: boolean;
    aafFunctions: Array<Array<string>> = [];
    functionalGroups: string[] = [];
    manualGroups: string[] = [];
    functions?: Array<[string, Array<string>]> = [];
    structures: { id: string, name: string, externalId: string }[] = [];
    classes: Classe[] = [];
    duplicates: { id: string, firstName: string, lastName: string, code: string, score: number, structures: { id: string, name: string }[] }[] = [];
    deleteDate?: number;
    disappearanceDate?: number;

    userDetails: UserDetailsModel;

    visibleStructures() {
        return this.structures.filter(structure => globalStore.structures.data
            .find(manageableStructure => manageableStructure.id === structure.id));
    }

    invisibleStructures() {
        return this.structures.filter(structure => globalStore.structures.data
            .every(manageableStructure => manageableStructure.id !== structure.id));
    }

    addStructure(structureId: string) {
        return this.http.put(`/directory/structure/${structureId}/link/${this.id}`)
            .then(() => {
                const targetStructure = globalStore.structures.data.find(s => s.id === structureId);
                if (targetStructure) {
                    this.structures.push({id: targetStructure.id, name: targetStructure.name, externalId: null});
                    if (targetStructure.users.data.length > 0)
                    {
                        targetStructure.users.data.push(this);
                        targetStructure.removedUsers.data = targetStructure.removedUsers.data
                            .filter(u => u.id !== this.id);
                    }
                    this.userDetails.unremoveFromStructure(targetStructure);
                }
            });
    }

    removeStructure(structureId: string) {
        return this.http.delete(`/directory/structure/${structureId}/unlink/${this.id}`)
            .then(() => {
                this.structures = this.structures.filter(s => s.id !== structureId);
                const targetStructure = globalStore.structures.data.find(s => s.id === structureId);
                if (targetStructure)
                {
                    if(targetStructure.users.data.length > 0)
                    {
                        targetStructure.users.data = targetStructure.users.data
                            .filter(u => u.id !== this.id);
                        targetStructure.removedUsers.data.push(this);
                    }
                    this.userDetails.removeFromStructure(targetStructure);
                }
            });
    }

    addClass(classe: Classe) {
        return this.http.put(`/directory/class/${classe.id}/link/${this.id}`)
            .then(() => {
                this.classes.push(classe);
            });
    }

    removeClass(classId: string, externalId: string) {
        return this.http.delete(`/directory/class/${classId}/unlink/${this.id}`)
            .then(() => {
                this.classes = this.classes.filter(c => c.id !== classId);
                if (this.userDetails.headTeacherManual) {
                    this.userDetails.headTeacherManual
                        .splice(this.userDetails.headTeacherManual.findIndex((f) => f === externalId), 1);
                }
            });
    }

    addManualGroup(group: GroupModel) {
        return this.http.post(`/directory/user/group/${this.id}/${group.id}`, {})
            .then(() => {
                this.manualGroups.push(group.name);
                this.userDetails.manualGroups.push(group);
            });
    }

    removeManualGroup(group: GroupModel) {
        return this.http.delete(`/directory/user/group/${this.id}/${group.id}`)
            .then(() => {
                this.manualGroups = this.manualGroups.filter(mg => mg === group.name);
                this.userDetails.manualGroups = this.userDetails.manualGroups
                    .filter(mg => group.id !== mg.id);
            });
    }

    addFunctionalGroup(group: GroupModel) {
        return this.http.post(`/directory/user/group/${this.id}/${group.id}`, {})
            .then(() => {
                this.functionalGroups.push(group.name);
                this.userDetails.functionalGroups.push(group);
            });
    }

    removeFunctionalGroup(group: GroupModel) {
        return this.http.delete(`/directory/user/group/${this.id}/${group.id}`)
            .then(() => {
                this.functionalGroups = this.functionalGroups.filter(fg => fg === group.name);
                this.userDetails.functionalGroups = this.userDetails.functionalGroups
                    .filter(fg => group.id !== fg.id);
            });
    }

    async mergeDuplicate(duplicateId: string): Promise<{ id: string, structure?: { id: string, name: string } }> {
        await this.http.put(`/directory/duplicate/merge/${this.id}/${duplicateId}`);
        const duplicate = this.duplicates.find(d => d.id === duplicateId);
        this.duplicates = this.duplicates.filter(d => d.id !== duplicateId);
        try {
            await this.userDetails.sync();
            return {id: this.id};
        } catch (e) {
            return {id: duplicate.id, structure: duplicate.structures[0]};
        }
    }

    separateDuplicate(duplicateId: string) {
        return this.http.delete(`/directory/duplicate/ignore/${this.id}/${duplicateId}`).then(() => {
            const duplicate = this.duplicates.find(d => d.id === duplicateId);
            duplicate.structures.forEach(duplicatedStructure => {
                const structure = globalStore.structures.data.find(struct => struct.id === duplicatedStructure.id);
                if (structure && structure.users.data.length > 0) {
                    const user = structure.users.data.find(rUser => rUser.id === duplicateId);
                    if (user) { user.duplicates = user.duplicates.filter(d => d.id !== this.id); }
                }
            });
            this.duplicates = this.duplicates.filter(d => d.id !== duplicateId);
        });
    }

    createNewUser(structureId) {
        const userPayload = new window.URLSearchParams();

        userPayload.append('firstName', this.firstName.trim());
        userPayload.append('lastName', this.lastName.trim());
        userPayload.append('type', this.type);
        if (this.classes && this.classes.length > 0) {
            userPayload.append('classId', this.classes[0].id);
        }
        userPayload.append('structureId', structureId);
        userPayload.append('birthDate', this.userDetails.birthDate);
        this.userDetails.children.forEach(child => userPayload.append('childrenIds', child.id));

        return this.http.post('/directory/api/user'
            , userPayload
            , {headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'}});
    }

    restore() {
        return this.http.put('/directory/restore/user', null, {params: {userId: this.id}})
            .then(() => {
                this.deleteDate = null;
                this.disappearanceDate = null;
            });
    }

    visibleRemovedStructures() {
        let rmStructs = this.userDetails.removedFromStructures != null ? this.userDetails.removedFromStructures : [];
        return globalStore.structures.data.filter(struct => rmStructs.indexOf(struct.externalId) != -1);
    }
}
