import {
    F,
    O,
    S
} from 'ts-toolbelt';

declare function get<Obj extends object, P extends string>(
    object: Obj, path: F.AutoPath<Obj, P>
): O.Path<Obj, S.Split<P, '.'>>

declare const user: User

type User = {
    name: string
    friends: User[]
}

// works
const friendName = get(user, 'friends.40.name')
const friendFriendName = get(user, 'friends.40.friends.12.name')

// errors
const friendNames = get(user, 'friends.40.names')
const friendFriendNames = get(user, 'friends.40.friends.12.names')
