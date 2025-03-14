import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as FsConstants from '../../../constants/fs'
import * as FsTypes from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as React from 'react'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/chat2'
import HelloBotCard from './cards/hello-bot'
import MakeTeamCard from './cards/make-team'
import NewChatCard from './cards/new-chat'
import ProfileResetNotice from './system-profile-reset-notice/container'
import RetentionNotice from './retention-notice/container'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  measure: (() => void) | null
}

const ErrorMessage = () => {
  const createConversationError = Container.useSelector(state => state.chat2.createConversationError)
  const dispatch = Container.useDispatch()

  const _onCreateWithoutThem = React.useCallback(
    (allowedUsers: Array<string>) => {
      dispatch(Chat2Gen.createCreateConversation({participants: allowedUsers}))
    },
    [dispatch]
  )

  const _onBack = React.useCallback(() => {
    dispatch(Chat2Gen.createNavigateToInbox())
  }, [dispatch])

  const onBack = Styles.isMobile ? _onBack : null

  let createConversationDisallowedUsers: Array<string> = []
  let createConversationErrorDescription = ''
  let createConversationErrorHeader = ''
  let onCreateWithoutThem: (() => void) | null = null
  if (createConversationError) {
    const {allowedUsers, code, disallowedUsers, message} = createConversationError
    if (code === RPCTypes.StatusCode.scteamcontactsettingsblock) {
      if (disallowedUsers.length === 1 && allowedUsers.length === 0) {
        // One-on-one conversation.
        createConversationErrorHeader = `You cannot start a conversation with @${disallowedUsers[0]}.`
        createConversationErrorDescription = `@${disallowedUsers[0]}'s contact restrictions prevent you from getting in touch. Contact them outside Keybase to proceed.`
      } else {
        // Group conversation.
        createConversationDisallowedUsers = disallowedUsers
        createConversationErrorHeader = 'The following people cannot be added to the conversation:'
        createConversationErrorDescription =
          'Their contact restrictions prevent you from getting in touch. Contact them outside Keybase to proceed.'
        if (disallowedUsers.length > 0 && allowedUsers.length > 0) {
          onCreateWithoutThem = () => _onCreateWithoutThem(allowedUsers)
        }
      }
    } else {
      createConversationErrorHeader = 'There was an error creating the conversation.'
      createConversationErrorDescription = message
    }
  }

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      gap="small"
      gapStart={true}
      centerChildren={true}
    >
      <Kb.Icon color={Styles.globalColors.black_20} sizeType="Huge" type="iconfont-warning" />
      <Kb.Text center={true} style={styles.errorText} type="Header">
        {createConversationErrorHeader}
      </Kb.Text>
      {createConversationDisallowedUsers.length > 0 && (
        <>
          {createConversationDisallowedUsers.map((username, idx) => (
            <Kb.ListItem2
              key={username}
              type={Styles.isMobile ? 'Large' : 'Small'}
              icon={<Kb.Avatar size={Styles.isMobile ? 48 : 32} username={username} />}
              firstItem={idx === 0}
              body={
                <Kb.Box2 direction="vertical" fullWidth={true}>
                  <Kb.Text type="BodySemibold">{username}</Kb.Text>
                </Kb.Box2>
              }
            />
          ))}
        </>
      )}
      <Kb.Text center={true} type="BodyBig" style={styles.errorText} selectable={true}>
        {createConversationErrorDescription}
      </Kb.Text>
      <Kb.ButtonBar direction={Styles.isMobile ? 'column' : 'row'} fullWidth={true} style={styles.buttonBar}>
        {onCreateWithoutThem && (
          <Kb.WaitingButton
            type="Default"
            label="Create without them"
            onClick={onCreateWithoutThem}
            waitingKey={null}
          />
        )}
        {onBack && (
          <Kb.WaitingButton
            type={onCreateWithoutThem ? 'Dim' : 'Default'}
            label={onCreateWithoutThem ? 'Cancel' : 'Okay'}
            onClick={onBack}
            waitingKey={null}
          />
        )}
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const SpecialTopMessage = (props: Props) => {
  const {conversationIDKey, measure} = props
  const username = Container.useSelector(state => state.config.username)
  const dispatch = Container.useDispatch()

  // we defer showing this so it doesn't flash so much
  const [allowDigging, setAllowDigging] = React.useState(false)

  React.useEffect(() => {
    const id = setTimeout(() => {
      setAllowDigging(true)
    }, 1000)
    return () => clearTimeout(id)
  }, [])

  const hasLoadedEver = Container.useSelector(
    state => state.chat2.messageOrdinals.get(conversationIDKey) !== undefined
  )
  const teamType = Container.useSelector(state => Constants.getMeta(state, conversationIDKey).teamType)
  const supersedes = Container.useSelector(state => Constants.getMeta(state, conversationIDKey).supersedes)
  const retentionPolicy = Container.useSelector(
    state => Constants.getMeta(state, conversationIDKey).retentionPolicy
  )
  const teamRetentionPolicy = Container.useSelector(
    state => Constants.getMeta(state, conversationIDKey).teamRetentionPolicy
  )

  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )

  let pendingState: 'waiting' | 'error' | 'done'
  switch (conversationIDKey) {
    case Constants.pendingWaitingConversationIDKey:
      pendingState = 'waiting'
      break
    case Constants.pendingErrorConversationIDKey:
      pendingState = 'error'
      break
    default:
      pendingState = 'done'
      break
  }
  const loadMoreType = Container.useSelector(state =>
    state.chat2.moreToLoadMap.get(conversationIDKey) !== false
      ? ('moreToLoad' as const)
      : ('noMoreToLoad' as const)
  )
  const showTeamOffer =
    hasLoadedEver && loadMoreType === 'noMoreToLoad' && teamType === 'adhoc' && participantInfo.all.length > 2
  const hasOlderResetConversation = supersedes !== Constants.noConversationIDKey
  // don't show default header in the case of the retention notice being visible
  const showRetentionNotice =
    retentionPolicy.type !== 'retain' &&
    !(retentionPolicy.type === 'inherit' && teamRetentionPolicy.type === 'retain')
  const isHelloBotConversation =
    teamType === 'adhoc' && participantInfo.all.length === 2 && participantInfo.all.includes('hellobot')
  const isSelfConversation =
    teamType === 'adhoc' && participantInfo.all.length === 1 && participantInfo.all.includes(username)

  const openPrivateFolder = React.useCallback(() => {
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/private/${username}`))
    )
  }, [dispatch, username])

  Container.useDepChangeEffect(() => {
    measure?.()
  }, [
    loadMoreType,
    showRetentionNotice,
    hasOlderResetConversation,
    pendingState,
    showTeamOffer,
    allowDigging,
  ])

  return (
    <Kb.Box>
      {loadMoreType === 'noMoreToLoad' && showRetentionNotice && (
        <RetentionNotice conversationIDKey={conversationIDKey} measure={measure} />
      )}
      <Kb.Box style={styles.spacer} />
      {hasOlderResetConversation && <ProfileResetNotice conversationIDKey={conversationIDKey} />}
      {pendingState === 'waiting' && (
        <Kb.Box style={styles.more}>
          <Kb.Text type="BodySmall">Loading...</Kb.Text>
        </Kb.Box>
      )}
      {pendingState === 'error' && <ErrorMessage />}
      {loadMoreType === 'noMoreToLoad' && !showRetentionNotice && pendingState === 'done' && (
        <Kb.Box style={styles.more}>
          {isHelloBotConversation ? (
            <HelloBotCard />
          ) : (
            <NewChatCard self={isSelfConversation} openPrivateFolder={openPrivateFolder} />
          )}
        </Kb.Box>
      )}
      {showTeamOffer && (
        <Kb.Box style={styles.more}>
          <MakeTeamCard conversationIDKey={conversationIDKey} />
        </Kb.Box>
      )}
      {allowDigging && loadMoreType === 'moreToLoad' && pendingState === 'done' && (
        <Kb.Box style={styles.more}>
          <Kb.Text type="BodyBig">
            <Kb.Emoji size={16} emojiName=":moyai:" />
          </Kb.Text>
          <Kb.Text type="BodySmallSemibold">Digging ancient messages...</Kb.Text>
        </Kb.Box>
      )}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {padding: Styles.globalMargins.small},
      errorText: {padding: Styles.globalMargins.small},
      more: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingBottom: Styles.globalMargins.medium,
        width: '100%',
      },
      spacer: {height: Styles.globalMargins.small},
    } as const)
)

export default SpecialTopMessage
